// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StudyFund
 * @dev Main contract for the StudyFund platform implementing donation, raffle, and scholarship systems
 */
contract StudyFund is ReentrancyGuard, AccessControl, Pausable {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SCHOLARSHIP_MANAGER_ROLE = keccak256("SCHOLARSHIP_MANAGER_ROLE");

    // Fund allocation percentages (immutable)
    uint256 private constant RAFFLE_ALLOCATION = 35;
    uint256 private constant SCHOLARSHIP_ALLOCATION = 45;
    uint256 private constant PLATFORM_ALLOCATION = 20;

    // Constants for USDT decimals and donation amounts
    uint256 private constant USDT_DECIMALS = 6;
    uint256 private constant USDT_DECIMAL_FACTOR = 10 ** USDT_DECIMALS;
    uint256 private constant PERCENTAGE_SCALE = 100;

    // Donation amounts in USDT with 6 decimals
    uint256 private constant DONATION_TIER_1 = 10 * USDT_DECIMAL_FACTOR;  // $10 USDT
    uint256 private constant DONATION_TIER_2 = 50 * USDT_DECIMAL_FACTOR;  // $50 USDT
    uint256 private constant DONATION_TIER_3 = 100 * USDT_DECIMAL_FACTOR; // $100 USDT

    // Donation tiers
    mapping(uint256 => uint256) public donationTierEntries;

    // Donor data structure
    struct Donor {
        uint256 totalDonated;
        uint256 entries;
        uint256[] raffleIds;
    }

    // Raffle data structure
    struct Raffle {
        uint256 startTime;
        uint256 endTime;
        uint256 prizePool;
        uint256 donations;
        address[] winners;
        bool completed;
        uint256 requestId;
        address[] runnerUps;
    }

    // State variables
    IERC20 public immutable usdt;
    mapping(address => Donor) public donors;
    mapping(uint256 => Raffle) public raffles;
    uint256 public currentRaffleId;
    uint256 public totalDonations;
    address[] public donorAddresses;
    
    // New constants for minimum guarantees
    uint256 private constant MINIMUM_PRIZE_POOL = 5000 * USDT_DECIMAL_FACTOR; // 5,000 USDT
    uint256 private constant MINIMUM_SCHOLARSHIP = 2000 * USDT_DECIMAL_FACTOR; // 2,000 USDT

    // New state variables
    address public reserveWallet;
    uint256 public reserveBalance;

    // Add new mappings for entry tracking
    mapping(uint256 => mapping(uint256 => address)) public raffleEntryOwners;
    mapping(uint256 => uint256) public raffleTotalEntries;

    // Add these constants instead
    uint256 private constant NUM_WINNERS = 5;

    // Mapping to track unclaimed prizes
    mapping(address => uint256) public unclaimedPrizes;

    // Add a separate mapping for winner prizes
    mapping(uint256 => mapping(address => uint256)) public rafflePrizes;

    // MVP Random number generation variables
    uint256 private nonce;

    // Events
    event DonationReceived(address indexed donor, uint256 amount, uint256 entries);
    event RaffleCompleted(uint256 indexed raffleId, address[] winners, uint256[] prizes);
    event ScholarshipAwarded(address indexed recipient, uint256 amount);
    event PlatformFundsWithdrawn(address indexed admin, uint256 amount);
    event ReserveDeposited(address indexed admin, uint256 amount);
    event ReserveWithdrawn(uint256 amount, string purpose);
    event ReserveWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event RunnerUpsSelected(uint256 indexed raffleId, address[] runnerUps);
    event PrizesClaimed(uint256 indexed raffleId, address indexed winner, uint256 amount);
    event PrizeCalculated(uint256 indexed raffleId, uint256 prizePool, uint256 percentage, uint256 calculatedPrize);

    constructor(
        address _usdtAddress,
        address _reserveWallet
    ) {
        require(_usdtAddress != address(0), "Invalid USDT address");
        require(_reserveWallet != address(0), "Invalid reserve wallet address");
        
        usdt = IERC20(_usdtAddress);
        reserveWallet = _reserveWallet;
        nonce = 0;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(SCHOLARSHIP_MANAGER_ROLE, msg.sender);

        // Setup donation tiers using mapping instead of array
        donationTierEntries[DONATION_TIER_1] = 1;  // $10 = 1 entry
        donationTierEntries[DONATION_TIER_2] = 6;  // $50 = 6 entries
        donationTierEntries[DONATION_TIER_3] = 15; // $100 = 15 entries

        // Initialize first raffle
        _startNewRaffle();
    }

    /**
     * @dev Allows users to donate USDT and receive raffle entries
     * @param amount The amount of USDT to donate
     */
    function donate(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= DONATION_TIER_1, "Donation below minimum");
        
        // Store values before external call
        uint256 entries = _calculateEntries(amount);
        uint256 startIndex = raffleTotalEntries[currentRaffleId];
        
        // Update state before external call
        if (donors[msg.sender].totalDonated == 0) {
            donorAddresses.push(msg.sender);
        }
        
        for (uint256 i = 0; i < entries; i++) {
            raffleEntryOwners[currentRaffleId][startIndex + i] = msg.sender;
        }
        raffleTotalEntries[currentRaffleId] += entries;
        
        donors[msg.sender].totalDonated += amount;
        donors[msg.sender].entries += entries;
        donors[msg.sender].raffleIds.push(currentRaffleId);
        totalDonations += amount;
        raffles[currentRaffleId].donations += amount;

        // External call after all state updates
        require(usdt.transferFrom(msg.sender, address(this), amount), "USDT transfer failed");

        emit DonationReceived(msg.sender, amount, entries);
    }

    /**
     * @dev Internal function to calculate raffle entries based on donation amount
     */
    function _calculateEntries(uint256 amount) internal view returns (uint256) {
        uint256 entries = 0;
        
        // Check highest tier first
        while (amount >= DONATION_TIER_3) {
            entries += donationTierEntries[DONATION_TIER_3];
            amount -= DONATION_TIER_3;
        }
        while (amount >= DONATION_TIER_2) {
            entries += donationTierEntries[DONATION_TIER_2];
            amount -= DONATION_TIER_2;
        }
        while (amount >= DONATION_TIER_1) {
            entries += donationTierEntries[DONATION_TIER_1];
            amount -= DONATION_TIER_1;
        }
        
        return entries;
    }

    /**
     * @dev Helper function for prize calculation with proper decimal handling
     */
    function _calculatePrize(uint256 prizePool, uint256 percentage) internal pure returns (uint256) {
        // Calculate prize amount with proper decimal handling
        // prizePool is in USDT with 6 decimals (e.g., 5000000000 for 5000 USDT)
        // percentage is in whole numbers (e.g., 45 for 45%)
        // We want to maintain precision throughout the calculation
        return (prizePool * percentage) / PERCENTAGE_SCALE;
    }

    /**
     * @dev Initiates the winner selection process for the current raffle
     */
    function selectWinners() external onlyRole(ADMIN_ROLE) {
        Raffle storage raffle = raffles[currentRaffleId];
        require(!raffle.completed, "Raffle already completed");
        require(raffleTotalEntries[currentRaffleId] > 0, "No entries in raffle");

        // Calculate current prize pool based on this raffle's donations
        uint256 currentPrizePool = (raffle.donations * RAFFLE_ALLOCATION) / PERCENTAGE_SCALE;

        // Check if we need to supplement from reserve
        if (currentPrizePool < MINIMUM_PRIZE_POOL) {
            uint256 supplementAmount = MINIMUM_PRIZE_POOL - currentPrizePool;
            require(reserveBalance >= supplementAmount, "Insufficient reserve balance");
            
            reserveBalance -= supplementAmount;
            currentPrizePool = MINIMUM_PRIZE_POOL;
            
            emit ReserveWithdrawn(supplementAmount, "Prize pool supplement");
        }

        // Set the prize pool and ensure it's at least MINIMUM_PRIZE_POOL
        require(currentPrizePool >= MINIMUM_PRIZE_POOL, "Prize pool too low");
        raffle.prizePool = currentPrizePool;

        // Select winners and runner-ups
        address[] memory winners = new address[](5);
        address[] memory runnerUps = new address[](5);
        uint256 totalEntries = _calculateTotalEntries();
        
        // Select winners
        for (uint256 i = 0; i < 5; i++) {
            uint256 randomNumber = _generateRandomNumber(totalEntries);
            winners[i] = _selectWinnerByEntry(randomNumber);
        }

        // Select runner-ups
        for (uint256 i = 0; i < 5; i++) {
            uint256 randomNumber = _generateRandomNumber(totalEntries);
            runnerUps[i] = _selectWinnerByEntry(randomNumber);
        }

        // Store winners and their prizes
        uint256[] memory prizes = new uint256[](5);
        uint256 remainingPrizePool = currentPrizePool;
        
        for (uint256 i = 0; i < 5; i++) {
            uint256 percentage = _getPrizePercentage(i);
            // Calculate prize using the helper function with proper decimal handling
            prizes[i] = _calculatePrize(currentPrizePool, percentage);
            emit PrizeCalculated(currentRaffleId, currentPrizePool, percentage, prizes[i]);
            remainingPrizePool -= prizes[i];
        }

        // Verify total prize distribution matches the prize pool
        require(remainingPrizePool == 0, "Prize distribution error");

        for (uint256 i = 0; i < 5; i++) {
            if (winners[i] != address(0)) {
                unclaimedPrizes[winners[i]] += prizes[i];
                rafflePrizes[currentRaffleId][winners[i]] = prizes[i];
            }
        }

        // Set winners, runner-ups and mark raffle as completed
        raffle.winners = winners;
        raffle.runnerUps = runnerUps;
        raffle.completed = true;

        emit RaffleCompleted(currentRaffleId, winners, prizes);
        emit RunnerUpsSelected(currentRaffleId, runnerUps);

        _startNewRaffle();
    }

    /**
     * @dev Generates a pseudo-random number
     * @notice This is a simplified MVP version. In production, use a more secure random number source
     */
    function _generateRandomNumber(uint256 max) internal returns (uint256) {
        nonce++;
        return uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            nonce
        ))) % max;
    }

    /**
     * @dev Internal function to start a new raffle period
     */
    function _startNewRaffle() internal {
        currentRaffleId++;
        Raffle storage newRaffle = raffles[currentRaffleId];
        newRaffle.startTime = block.timestamp;
        newRaffle.endTime = block.timestamp + 7 days;
        newRaffle.prizePool = 0;
        newRaffle.donations = 0;
        newRaffle.completed = false;
        newRaffle.requestId = 0;
        newRaffle.winners = new address[](0);
        newRaffle.runnerUps = new address[](0);
    }

    /**
     * @dev Allows admin to award scholarships
     */
    function awardScholarship(address recipient, uint256 amount) 
        external 
        onlyRole(SCHOLARSHIP_MANAGER_ROLE) 
        nonReentrant 
    {
        uint256 scholarshipBalance = getScholarshipBalance();
        
        // If scholarship balance is below minimum, supplement from reserve
        if (scholarshipBalance < MINIMUM_SCHOLARSHIP) {
            uint256 supplementAmount = MINIMUM_SCHOLARSHIP - scholarshipBalance;
            require(reserveBalance >= supplementAmount, "Insufficient reserve balance");
            
            reserveBalance -= supplementAmount;
            scholarshipBalance = MINIMUM_SCHOLARSHIP;
            
            emit ReserveWithdrawn(supplementAmount, "Scholarship supplement");
        }

        require(amount <= scholarshipBalance, "Insufficient scholarship funds");
        require(usdt.transfer(recipient, amount), "Scholarship transfer failed");
        
        emit ScholarshipAwarded(recipient, amount);
    }

    /**
     * @dev Returns the available balance for scholarships
     */
    function getScholarshipBalance() public view returns (uint256) {
        return (raffles[currentRaffleId].donations * SCHOLARSHIP_ALLOCATION) / PERCENTAGE_SCALE;
    }

    /**
     * @dev Emergency pause function
     */
    function pause() external onlyRole(ADMIN_ROLE) whenNotPaused {
        _pause();
    }

    /**
     * @dev Resume contract operations
     */
    function unpause() external onlyRole(ADMIN_ROLE) whenPaused {
        _unpause();
    }

    /**
     * @dev Updates the reserve wallet address
     */
    function setReserveWallet(address _newWallet) external onlyRole(ADMIN_ROLE) {
        require(_newWallet != address(0), "Invalid wallet address");
        address oldWallet = reserveWallet;
        reserveWallet = _newWallet;
        emit ReserveWalletUpdated(oldWallet, _newWallet);
    }

    /**
     * @dev Allows admins to deposit USDT into the reserve
     */
    function depositToReserve(uint256 amount) external nonReentrant onlyRole(ADMIN_ROLE) {
        require(amount > 0, "Amount must be greater than 0");
        
        // Update state before external call
        reserveBalance += amount;
        
        // External call after state update
        require(usdt.transferFrom(msg.sender, address(this), amount), "USDT transfer failed");
        
        emit ReserveDeposited(msg.sender, amount);
    }

    /**
     * @dev Helper function to calculate total entries
     */
    function _calculateTotalEntries() internal view returns (uint256) {
        return raffleTotalEntries[currentRaffleId];
    }

    /**
     * @dev Helper function to select winner by entry number
     */
    function _selectWinnerByEntry(uint256 winningEntry) internal view returns (address) {
        return raffleEntryOwners[currentRaffleId][winningEntry];
    }

    /**
     * @dev Allows winners to claim their prizes
     */
    function claimPrize() external nonReentrant {
        uint256 amount = unclaimedPrizes[msg.sender];
        require(amount > 0, "No prizes to claim");
        
        unclaimedPrizes[msg.sender] = 0;
        require(usdt.transfer(msg.sender, amount), "Prize transfer failed");
        
        emit PrizesClaimed(currentRaffleId - 1, msg.sender, amount);
    }

    // Add this function instead
    function _getPrizePercentage(uint256 place) internal pure returns (uint256) {
        require(place < NUM_WINNERS, "Invalid place");
        if (place == 0) return 45;      // 1st place: 45%
        if (place == 1) return 25;      // 2nd place: 25%
        if (place == 2) return 15;      // 3rd place: 15%
        if (place == 3) return 10;      // 4th place: 10%
        if (place == 4) return 5;       // 5th place: 5%
        return 0;
    }

    /**
     * @dev Returns the winners of a specific raffle
     * @param raffleId The ID of the raffle
     */
    function getRaffleWinners(uint256 raffleId) external view returns (address[] memory) {
        return raffles[raffleId].winners;
    }

    /**
     * @dev Returns the runner-ups of a specific raffle
     * @param raffleId The ID of the raffle
     */
    function getRaffleRunnerUps(uint256 raffleId) external view returns (address[] memory) {
        return raffles[raffleId].runnerUps;
    }

    // Additional admin and view functions...
}
