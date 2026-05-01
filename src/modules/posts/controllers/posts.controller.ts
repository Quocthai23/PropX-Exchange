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
  UseGuards,
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@ApiTags('Posts')
@Controller('posts')
@UseGuards(JwtAuthGuard)
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
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryPostsDto,
  ) {
    return await this.postsService.getPosts(user.sub, query);
  }

  // NOTE: Route /me/bookmarks must be placed BEFORE route /:postId to avoid misrouting
  @Get('me/bookmarks')
  @ApiOperation({ summary: 'List bookmarked posts' })
  @ApiResponse({
    status: 200,
    description: 'Return paginated list of bookmarked posts',
  })
  async getBookmarkedPosts(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return await this.postsService.getBookmarkedPosts(user.sub, query);
  }

  @Get(':postId')
  @ApiOperation({ summary: 'Get post detail' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({ status: 200, description: 'Return a single post detail' })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async getPost(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
  ) {
    return await this.postsService.getPostById(user.sub, postId);
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
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePostDto,
  ) {
    return await this.postsService.createPost(user.sub, dto);
  }

  @Patch(':postId')
  @ApiOperation({ summary: 'Update post' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async updatePost(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
    @Body() dto: Partial<CreatePostDto>,
  ) {
    return await this.postsService.updatePost(user.sub, postId, dto);
  }

  @Delete(':postId')
  @ApiOperation({ summary: 'Delete post' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async deletePost(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
  ) {
    return await this.postsService.deletePost(user.sub, postId);
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
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
  ) {
    return await this.postsService.togglePostLike(user.sub, postId);
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
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
  ) {
    return await this.postsService.togglePostBookmark(user.sub, postId);
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
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return await this.postsService.getPostComments(user.sub, postId, query);
  }

  @Post(':postId/comments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create post comment' })
  @ApiParam({ name: 'postId', type: 'string', description: 'Post identifier' })
  @ApiResponse({ status: 200, description: 'Comment created successfully' })
  @ApiNotFoundResponse({ description: 'Requested post was not found.' })
  async createComment(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
    @Body() dto: CommentDto,
  ) {
    return await this.postsService.createComment(user.sub, postId, dto);
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Update comment' })
  @ApiParam({ name: 'id', type: 'string', description: 'Comment identifier' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiNotFoundResponse({ description: 'Requested comment was not found.' })
  async updateComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') commentId: string,
    @Body() dto: CommentDto,
  ) {
    return await this.postsService.updateComment(user.sub, commentId, dto);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete comment' })
  @ApiParam({ name: 'id', type: 'string', description: 'Comment identifier' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiNotFoundResponse({ description: 'Requested comment was not found.' })
  async deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') commentId: string,
  ) {
    return await this.postsService.deleteComment(user.sub, commentId);
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
    @CurrentUser() user: JwtPayload,
    @Param('id') commentId: string,
  ) {
    return await this.postsService.toggleCommentLike(user.sub, commentId);
  }
}
