import { Controller, Post, Get, Body, Headers, UnauthorizedException, Logger, Query, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async handleWebhook(
    @Body() body: any,
    @Headers('goldsky-webhook-secret') webhookSecret: string,
  ) {
    // Validate the webhook secret
    const expectedSecret = this.configService.get<string>('GOLDSKY_WEBHOOK_SECRET');
    
    if (!webhookSecret || webhookSecret !== expectedSecret) {
      this.logger.warn('Invalid webhook secret received');
      throw new UnauthorizedException('Invalid webhook secret');
    }

    try {
      // Process the webhook event
      await this.webhookService.processEvent(body);
      
      // Return a success response
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      
      // Return an error response, but with a 200 status code
      // This prevents Goldsky from retrying the webhook
      return { 
        success: false, 
        message: 'Error processing webhook', 
        error: error.message 
      };
    }
  }

  /**
   * Get donation leaderboard with pagination
   */
  @Get('leaderboard')
  async getDonationLeaderboard(
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0
  ) {
    try {
      const leaderboard = await this.webhookService.getDonationLeaderboard(limit, offset);
      return { success: true, data: leaderboard };
    } catch (error) {
      this.logger.error(`Error fetching leaderboard: ${error.message}`, error.stack);
      return { 
        success: false, 
        message: 'Error fetching leaderboard', 
        error: error.message 
      };
    }
  }

  /**
   * Get donation stats (total donations, number of donors, etc.)
   */
  @Get('stats')
  async getDonationStats() {
    try {
      const stats = await this.webhookService.getDonationStats();
      return { success: true, data: stats };
    } catch (error) {
      this.logger.error(`Error fetching donation stats: ${error.message}`, error.stack);
      return { 
        success: false, 
        message: 'Error fetching donation stats', 
        error: error.message 
      };
    }
  }

  /**
   * Get a specific donor's donation history
   */
  @Get('donor/:address')
  async getDonorInfo(@Param('address') address: string) {
    try {
      const donorInfo = await this.webhookService.getDonorInfo(address);
      return { success: true, data: donorInfo };
    } catch (error) {
      this.logger.error(`Error fetching donor info: ${error.message}`, error.stack);
      return { 
        success: false, 
        message: 'Error fetching donor info', 
        error: error.message 
      };
    }
  }

  /**
   * Get a donor's complete history of donations and rewards
   */
  @Get('donor/:address/history')
  async getDonorHistory(
    @Param('address') address: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0
  ) {
    try {
      const history = await this.webhookService.getDonorHistory(address, limit, offset);
      return { success: true, data: history };
    } catch (error) {
      this.logger.error(`Error fetching donor history: ${error.message}`, error.stack);
      return { 
        success: false, 
        message: 'Error fetching donor history', 
        error: error.message 
      };
    }
  }
} 