import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
  Query,
  Param,
} from '@nestjs/common';
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
    const expectedSecret = this.configService.get<string>(
      'GOLDSKY_WEBHOOK_SECRET',
    );

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
      this.logger.error(
        `Error processing webhook: ${error.message}`,
        error.stack,
      );

      // Return an error response, but with a 200 status code
      // This prevents Goldsky from retrying the webhook
      return {
        success: false,
        message: 'Error processing webhook',
        error: error.message,
      };
    }
  }
}
