import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { PostsService } from '../services/posts.service';
import { CreatePostDto } from '../dto/create-post.dto';
import {
  QueryPostsDto,
  PaginationQueryDto,
  CommentDto,
} from '../dto/posts.dto';
// Chú ý: Cập nhật lại đường dẫn import JwtAuthGuard và CurrentUser cho đúng với dự án của bạn
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Posts')
@Controller('posts')
// @UseGuards(JwtAuthGuard) // Kích hoạt Guard này khi ghép code thực tế
@ApiBearerAuth('accessToken')
@ApiBadRequestResponse({
  description: 'Malformed request payload or failed domain validation.',
})
@ApiUnauthorizedResponse({
  description: 'Authentication is missing, invalid, revoked, or expired.',
})
@ApiForbiddenResponse({
  description:
    'Authenticated but not allowed to access or mutate this resource.',
})
@ApiInternalServerErrorResponse({
  description: 'Unexpected server error or upstream dependency failure.',
})
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // ==========================================
  // POSTS SECTION
  // ==========================================

  @Get()
  @ApiOperation({
    summary: 'List posts',
    description: 'List social posts with filtering and sorting',
  })
  @ApiResponse({ status: 200, description: 'Return paginated list of posts' })
  async getPosts(
    @Query() query: QueryPostsDto /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.getPosts(userId, query);
  }

  // CHÚ Ý: Route /me/bookmarks phải đặt TRƯỚC route /:postId để tránh bị bắt nhầm
  @Get('me/bookmarks')
  @ApiOperation({ summary: 'List bookmarked posts' })
  @ApiResponse({
    status: 200,
    description: 'Return paginated list of bookmarked posts',
  })
  async getBookmarkedPosts(
    @Query() query: PaginationQueryDto /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.getBookmarkedPosts(userId, query);
  }

  @Get(':postId')
  @ApiOperation({ summary: 'Get post detail' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({ status: 200, description: 'Return a single post detail' })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async getPost(
    @Param('postId') postId: string /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.getPostById(userId, postId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create post',
    description:
      'Create a new social post. \n\n**Business Workflow:** Requires user to be fully authenticated. Supports Text, Images, and Video linking.',
  })
  @ApiConsumes(
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
  )
  @ApiResponse({ status: 200, description: 'Post created successfully' })
  async createPost(
    @Body() dto: CreatePostDto /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id'; // user.sub
    return await this.postsService.createPost(userId, dto);
  }

  @Patch(':postId')
  @ApiOperation({ summary: 'Update post' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async updatePost(
    @Param('postId') postId: string,
    @Body() dto: Partial<CreatePostDto> /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.updatePost(userId, postId, dto);
  }

  @Delete(':postId')
  @ApiOperation({ summary: 'Delete post' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async deletePost(
    @Param('postId') postId: string /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.deletePost(userId, postId);
  }

  @Post(':postId/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle post like' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({
    status: 200,
    description: 'Returns boolean indicating like status',
  })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async togglePostLike(
    @Param('postId') postId: string /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.togglePostLike(userId, postId);
  }

  @Post(':postId/bookmark')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle post bookmark' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({
    status: 200,
    description: 'Returns boolean indicating bookmark status',
  })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async togglePostBookmark(
    @Param('postId') postId: string /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.togglePostBookmark(userId, postId);
  }

  // ==========================================
  // COMMENTS SECTION
  // ==========================================

  @Get(':postId/comments')
  @ApiOperation({ summary: 'List post comments' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({
    status: 200,
    description: 'Return paginated list of comments',
  })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async getComments(
    @Param('postId') postId: string,
    @Query() query: PaginationQueryDto /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.getPostComments(userId, postId, query);
  }

  @Post(':postId/comments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create post comment' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({ status: 200, description: 'Comment created successfully' })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async createComment(
    @Param('postId') postId: string,
    @Body() dto: CommentDto /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.createComment(userId, postId, dto);
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Update comment' })
  @ApiParam({ name: 'id', type: 'string', description: 'Comment identifier' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiNotFoundResponse({ description: 'Requested comment was not found.' })
  async updateComment(
    @Param('id') commentId: string,
    @Body() dto: CommentDto /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.updateComment(userId, commentId, dto);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete comment' })
  @ApiParam({ name: 'id', type: 'string', description: 'Comment identifier' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiNotFoundResponse({ description: 'Requested comment was not found.' })
  async deleteComment(
    @Param('id') commentId: string /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.deleteComment(userId, commentId);
  }

  @Post('comments/:id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle comment like' })
  @ApiParam({ name: 'id', type: 'string', description: 'Comment identifier' })
  @ApiResponse({
    status: 200,
    description: 'Returns boolean indicating like status',
  })
  @ApiNotFoundResponse({ description: 'Requested comment was not found.' })
  async toggleCommentLike(
    @Param('id') commentId: string /*, @CurrentUser() user: JwtPayload */,
  ) {
    const userId = 'mock-user-id';
    return await this.postsService.toggleCommentLike(userId, commentId);
  }
}
