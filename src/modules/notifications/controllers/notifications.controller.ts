import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from '../services/notifications.service';
import { GetNotificationsQueryDto } from '../dto/notifications.dto';
// TODO: Import JwtAuthGuard và CurrentUser từ auth module

@ApiTags('Notifications')
@Controller('notifications')
@ApiBearerAuth('accessToken')
// @UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description: 'List notifications for the current authenticated user',
  })
  async getNotifications(@Query() query: GetNotificationsQueryDto) {
    const userId = 'mock-user-id'; // Lấy từ @CurrentUser
    return this.notificationsService.getNotifications(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount() {
    const userId = 'mock-user-id';
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Read all notifications',
    description: 'Mark all notifications as read for current user',
  })
  async markAllAsRead() {
    const userId = 'mock-user-id';
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':notificationId/read')
  @ApiOperation({
    summary: 'Read notification',
    description: 'Mark a notification as read for current user',
  })
  async markAsRead(@Param('notificationId') notificationId: string) {
    const userId = 'mock-user-id';
    return this.notificationsService.markAsRead(userId, notificationId);
  }
}
