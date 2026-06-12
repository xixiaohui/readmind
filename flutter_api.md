# ReadMind API 文档 - Flutter 移动端

> **基础 URL**: `https://your-api-domain.com`  
> **API 版本**: v1  
> **最后更新**: 2026-06-12

---

## 目录

1. [快速开始](#快速开始)
2. [认证机制](#认证机制)
3. [统一响应格式](#统一响应格式)
4. [错误码说明](#错误码说明)
5. [API 端点详情](#api-端点详情)
   - [认证相关](#认证相关)
   - [书籍管理](#书籍管理)
   - [工作流与分析](#工作流与分析)
   - [支付系统](#支付系统)
   - [管理后台](#管理后台)
6. [Flutter 集成示例](#flutter-集成示例)
7. [数据类型定义](#数据类型定义)

---

## 快速开始

### 1. 添加依赖

在 `pubspec.yaml` 中添加 HTTP 客户端依赖：

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
  shared_preferences: ^2.2.2  # 用于本地存储 token
```

### 2. 基础配置

```dart
// lib/config/api_config.dart
class ApiConfig {
  static const String baseUrl = 'https://your-api-domain.com';
  static const String apiPrefix = '/api';

  // API 端点
  static String get login => '$baseUrl$apiPrefix/auth/login';
  static String get register => '$baseUrl$apiPrefix/auth/register';
  static String get me => '$baseUrl$apiPrefix/auth/me';
  static String get library => '$baseUrl$apiPrefix/library';
  static String get books => '$baseUrl$apiPrefix/books';

  // 获取带认证的请求头
  static Future<Map<String, String>> getAuthHeaders(String? token) async {
    final headers = {
      'Content-Type': 'application/json',
    };
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }
}
```

---

## 认证机制

ReadMind API 使用 **JWT (JSON Web Token)** 进行身份验证。

### 认证流程

1. **注册/登录** → 获取 `token`
2. **存储 token** → 使用 `shared_preferences` 本地存储
3. **携带 token** → 在后续请求的 `Authorization` 头中携带
4. **验证 token** → 调用 `/api/auth/me` 验证 token 是否有效

### Token 存储示例

```dart
// lib/services/auth_service.dart
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const String _tokenKey = 'readmind_token';
  static const String _userKey = 'readmind_user';

  // 保存 token
  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  // 获取 token
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  // 清除 token（登出）
  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }

  // 检查是否已登录
  static Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
```

---

## 统一响应格式

所有 API 响应都遵循统一的 JSON 格式：

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }  // 可选，包含分页等元信息
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }  // 可选，详细错误信息
  }
}
```

### Flutter 通用响应模型

```dart
// lib/models/api_response.dart
class ApiResponse<T> {
  final bool success;
  final T? data;
  final ApiError? error;
  final Map<String, dynamic>? meta;

  ApiResponse({
    required this.success,
    this.data,
    this.error,
    this.meta,
  });

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic)? fromJsonT,
  ) {
    return ApiResponse<T>(
      success: json['success'] as bool,
      data: json['data'] != null && fromJsonT != null
          ? fromJsonT(json['data'])
          : json['data'],
      error: json['error'] != null
          ? ApiError.fromJson(json['error'])
          : null,
      meta: json['meta'] as Map<String, dynamic>?,
    );
  }
}

class ApiError {
  final String code;
  final String message;
  final dynamic details;

  ApiError({
    required this.code,
    required this.message,
    this.details,
  });

  factory ApiError.fromJson(Map<String, dynamic> json) {
    return ApiError(
      code: json['code'] as String,
      message: json['message'] as String,
      details: json['details'],
    );
  }
}
```

---

## 错误码说明

| 错误码 | HTTP 状态码 | 说明 | 处理建议 |
|--------|------------|------|----------|
| `BAD_REQUEST` | 400 | 请求参数错误 | 检查请求参数格式 |
| `UNAUTHORIZED` | 401 | 未授权/Token 无效 | 重新登录获取新 token |
| `FORBIDDEN` | 403 | 无权限 | 检查用户权限 |
| `NOT_FOUND` | 404 | 资源不存在 | 检查请求的资源 ID |
| `QUOTA_EXCEEDED` | 402 | 分析额度已用完 | 引导用户升级会员 |
| `SERVER_ERROR` | 500 | 服务器内部错误 | 重试或联系客服 |
| `CONFIG` | 500 | 服务器配置错误 | 联系管理员 |

---

## API 端点详情

### 认证相关

#### 1. 用户注册

**POST** `/api/auth/register`

注册新用户账号。

**请求参数:**

```json
{
  "email": "string",      // 必填，邮箱格式
  "password": "string",   // 必填，至少 8 个字符
  "name": "string"        // 可选，用户名称
}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "用户名"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Flutter 示例:**

```dart
// lib/services/auth_service.dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<ApiResponse<Map<String, dynamic>>> register({
  required String email,
  required String password,
  String? name,
}) async {
  final response = await http.post(
    Uri.parse(ApiConfig.register),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'email': email,
      'password': password,
      if (name != null) 'name': name,
    }),
  );

  final json = jsonDecode(response.body);
  return ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);
}
```

---

#### 2. 用户登录

**POST** `/api/auth/login`

使用邮箱和密码登录。

**请求参数:**

```json
{
  "email": "string",     // 必填
  "password": "string"   // 必填
}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "用户名"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Flutter 示例:**

```dart
Future<ApiResponse<Map<String, dynamic>>> login({
  required String email,
  required String password,
}) async {
  final response = await http.post(
    Uri.parse(ApiConfig.login),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'email': email,
      'password': password,
    }),
  );

  final json = jsonDecode(response.body);
  final result = ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);

  // 登录成功，保存 token
  if (result.success && result.data != null) {
    final token = result.data!['token'] as String;
    await AuthService.saveToken(token);
  }

  return result;
}
```

---

#### 3. 获取当前用户信息

**GET** `/api/auth/me`

获取当前登录用户的详细信息（需要认证）。

**请求头:**

```
Authorization: Bearer {token}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "用户名"
    },
    "membership": {
      "tier": "free",  // free, monthly, quarterly, yearly
      "expiresAt": "2026-07-12T00:00:00.000Z"
    },
    "usage": {
      "count": 2,    // 本月已分析数量
      "limit": 3      // 本月分析限额（free: 3, 付费: -1 表示无限制）
    }
  }
}
```

**Flutter 示例:**

```dart
Future<ApiResponse<Map<String, dynamic>>> getCurrentUser() async {
  final token = await AuthService.getToken();
  if (token == null) {
    return ApiResponse(
      success: false,
      error: ApiError(code: 'UNAUTHORIZED', message: '未登录'),
    );
  }

  final response = await http.get(
    Uri.parse(ApiConfig.me),
    headers: await ApiConfig.getAuthHeaders(token),
  );

  final json = jsonDecode(response.body);
  return ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);
}
```

---

### 书籍管理

#### 4. 上传书籍

**POST** `/api/books/upload`

上传书籍文本并开始分析。

**请求参数:**

```json
{
  "title": "string",      // 必填，书籍标题
  "author": "string",     // 可选，作者
  "text": "string",       // 必填，书籍全文（至少 100 字符）
  "isPublic": boolean     // 可选，是否公开，默认 true
}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "bookId": "uuid",
    "title": "书名",
    "author": "作者",
    "status": "analyzing",
    "workflowId": "uuid",
    "createdAt": "2026-06-12T10:00:00.000Z"
  },
  "meta": {
    "textLength": 50000
  }
}
```

**Flutter 示例:**

```dart
// lib/services/book_service.dart
Future<ApiResponse<Map<String, dynamic>>> uploadBook({
  required String title,
  String? author,
  required String text,
  bool isPublic = true,
}) async {
  final token = await AuthService.getToken();
  final response = await http.post(
    Uri.parse('${ApiConfig.books}/upload'),
    headers: await ApiConfig.getAuthHeaders(token),
    body: jsonEncode({
      'title': title,
      'author': author,
      'text': text,
      'isPublic': isPublic,
    }),
  );

  final json = jsonDecode(response.body);
  return ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);
}
```

---

#### 5. 获取书籍详情

**GET** `/api/books/{id}`

获取书籍的详细信息，包括分析结果、工作流状态、金句、主题等（需要认证）。

**查询参数:**

- `includeRawText=true` - 可选，是否包含原始文本（用于阅读器）

**响应示例:**

```json
{
  "success": true,
  "data": {
    "book": {
      "id": "uuid",
      "title": "书名",
      "author": "作者",
      "status": "completed",  // uploaded, analyzing, completed, failed
      "chunkCount": 10,
      "isPublic": true,
      "createdAt": "2026-06-12T10:00:00.000Z",
      "updatedAt": "2026-06-12T10:30:00.000Z"
    },
    "analyses": [
      {
        "id": "uuid",
        "type": "summary",  // summary, theme, quote, philosophy, emotion, etc.
        "result": { ... },  // 分析结果，结构取决于 type
        "createdAt": "2026-06-12T10:15:00.000Z"
      }
    ],
    "latestWorkflow": {
      "id": "uuid",
      "status": "completed",  // pending, running, completed, failed
      "progress": 1.0,
      "currentNode": "END",
      "errors": [],
      "steps": [
        {
          "nodeName": "init",
          "status": "completed",
          "error": null
        }
      ]
    },
    "quotes": [
      {
        "id": "uuid",
        "text": "金句内容",
        "context": "上下文",
        "category": "insight",
        "score": 0.95
      }
    ],
    "themes": [
      {
        "id": "uuid",
        "name": "主题名称",
        "description": "主题描述",
        "weight": 0.85,
        "evidence": "证据"
      }
    ]
  }
}
```

**Flutter 示例:**

```dart
Future<ApiResponse<Map<String, dynamic>>> getBookDetail(
  String bookId, {
  bool includeRawText = false,
}) async {
  final token = await AuthService.getToken();
  final uri = Uri.parse('${ApiConfig.books}/$bookId').replace(
    queryParameters: {
      if (includeRawText) 'includeRawText': 'true',
    },
  );

  final response = await http.get(
    uri,
    headers: await ApiConfig.getAuthHeaders(token),
  );

  final json = jsonDecode(response.body);
  return ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);
}
```

---

#### 6. 更新书籍信息

**PATCH** `/api/books/{id}`

更新书籍信息，目前支持更新 `isPublic` 字段。

**请求参数:**

```json
{
  "isPublic": boolean  // 可选，是否公开
}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "updated": "uuid",
    "title": "书名",
    "changes": {
      "isPublic": true
    }
  }
}
```

**Flutter 示例:**

```dart
Future<ApiResponse<Map<String, dynamic>>> updateBook({
  required String bookId,
  bool? isPublic,
}) async {
  final token = await AuthService.getToken();
  final body = <String, dynamic>{};
  if (isPublic != null) body['isPublic'] = isPublic;

  final response = await http.patch(
    Uri.parse('${ApiConfig.books}/$bookId'),
    headers: await ApiConfig.getAuthHeaders(token),
    body: jsonEncode(body),
  );

  final json = jsonDecode(response.body);
  return ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);
}
```

---

#### 7. 删除书籍

**DELETE** `/api/books/{id}`

删除书籍及其所有相关数据（需要认证，只能删除自己的书籍）。

**响应示例:**

```json
{
  "success": true,
  "data": {
    "deleted": "uuid",
    "title": "书名"
  }
}
```

**Flutter 示例:**

```dart
Future<ApiResponse<Map<String, dynamic>>> deleteBook(String bookId) async {
  final token = await AuthService.getToken();
  final response = await http.delete(
    Uri.parse('${ApiConfig.books}/$bookId'),
    headers: await ApiConfig.getAuthHeaders(token),
  );

  final json = jsonDecode(response.body);
  return ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);
}
```

---

#### 8. 获取公开书籍列表

**GET** `/api/books/public`

获取所有公开书籍列表（无需认证）。

**查询参数:**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `limit` | number | 20 | 每页数量（最大 100） |
| `search` | string | - | 搜索关键词（标题/作者） |
| `sort` | string | createdAt | 排序字段：createdAt, title, completedAt |
| `order` | string | desc | 排序方向：asc, desc |

**响应示例:**

```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": "uuid",
        "title": "书名",
        "author": "作者",
        "status": "completed",
        "chunkCount": 10,
        "createdAt": "2026-06-12T10:00:00.000Z",
        "updatedAt": "2026-06-12T10:30:00.000Z",
        "stats": {
          "analysisCount": 8,
          "hasThemes": true,
          "hasQuotes": true,
          "hasSummary": true
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

**Flutter 示例:**

```dart
Future<ApiResponse<Map<String, dynamic>>> getPublicBooks({
  int page = 1,
  int limit = 20,
  String? search,
  String sort = 'createdAt',
  String order = 'desc',
}) async {
  final queryParams = {
    'page': page.toString(),
    'limit': limit.toString(),
    'sort': sort,
    'order': order,
    if (search != null) 'search': search,
  };

  final uri = Uri.parse('${ApiConfig.books}/public').replace(
    queryParameters: queryParams,
  );

  final response = await http.get(uri);
  final json = jsonDecode(response.body);
  return ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);
}
```

---

#### 9. 开始分析

**POST** `/api/books/analyze`

对已上传的书籍开始 AI 分析（需要认证）。也可用于重试失败的分析。

**请求参数:**

```json
{
  "bookId": "uuid"  // 必填，书籍 ID
}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "workflowId": "uuid",
    "status": "running",
    "bookId": "uuid",
    "title": "书名"
  }
}
```

**Flutter 示例:**

```dart
Future<ApiResponse<Map<String, dynamic>>> startAnalysis(String bookId) async {
  final token = await AuthService.getToken();
  final response = await http.post(
    Uri.parse('${ApiConfig.books}/analyze'),
    headers: await ApiConfig.getAuthHeaders(token),
    body: jsonEncode({'bookId': bookId}),
  );

  final json = jsonDecode(response.body);
  return ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);
}
```

---

#### 10. 生成书籍海报

**GET** `/api/books/{id}/poster`

生成书籍分析的海报图片（PNG 格式）。

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | string | 海报类型：summary, quote, themes, character, psychology, sociology, politicalEconomy, literaryCritic, religious |
| `qi` | number | 金句索引（仅 type=quote 时） |

**响应:** PNG 图片流

**Flutter 示例:**

```dart
Future<Uint8List?> getBookPoster({
  required String bookId,
  required String type,
  int? quoteIndex,
}) async {
  final queryParams = {
    'type': type,
    if (quoteIndex != null) 'qi': quoteIndex.toString(),
  };

  final uri = Uri.parse('${ApiConfig.books}/$bookId/poster').replace(
    queryParameters: queryParams,
  );

  final response = await http.get(uri);
  if (response.statusCode == 200) {
    return response.bodyBytes;
  }
  return null;
}

// 使用示例：保存海报到本地
Future<void> savePosterToGallery({
  required String bookId,
  required String type,
}) async {
  final imageBytes = await getBookPoster(bookId: bookId, type: type);
  if (imageBytes != null) {
    // 使用 image_gallery_saver 或 gal 等插件保存到相册
    // await ImageGallerySaver.saveImage(imageBytes);
  }
}
```

---

### 工作流与分析

#### 11. 获取工作流状态

**GET** `/api/workflows/{id}`

获取工作流的详细状态和进度信息。

**响应示例:**

```json
{
  "success": true,
  "data": {
    "workflow": {
      "id": "uuid",
      "bookId": "uuid",
      "bookTitle": "书名",
      "bookAuthor": "作者",
      "status": "running",  // pending, running, completed, failed
      "currentNode": "themeAnalyzer",
      "currentChunkIndex": 2,
      "progress": 0.45,
      "retryCount": 0,
      "errors": [],
      "startedAt": "2026-06-12T10:00:00.000Z",
      "completedAt": null
    },
    "steps": [
      {
        "nodeName": "init",
        "status": "completed",
        "icon": "✓",
        "error": null,
        "startedAt": "2026-06-12T10:00:00.000Z",
        "completedAt": "2026-06-12T10:00:05.000Z",
        "durationMs": 5000
      }
    ],
    "details": {
      "chunks": {
        "total": 10,
        "current": 2
      },
      "agentOutputs": {
        "themes": 5,
        "summaries": 2,
        "quotes": 15,
        "philosophyFrameworks": 3,
        "emotionSnapshots": 10
      },
      "textLength": 50000,
      "estimatedTokens": 12500,
      "model": "gpt-4",
      "errors": []
    },
    "summary": {
      "totalSteps": 11,
      "completedSteps": 4,
      "totalDurationMs": null
    }
  }
}
```

**Flutter 示例:**

```dart
Future<ApiResponse<Map<String, dynamic>>> getWorkflowStatus(String workflowId) async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/workflows/$workflowId'),
  );

  final json = jsonDecode(response.body);
  return ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);
}

// 轮询工作流状态
Stream<Map<String, dynamic>> pollWorkflowStatus(String workflowId) async* {
  while (true) {
    final response = await getWorkflowStatus(workflowId);
    if (response.success && response.data != null) {
      final workflow = response.data!['workflow'];
      yield workflow;

      // 如果工作流已完成或失败，停止轮询
      if (workflow['status'] == 'completed' || workflow['status'] == 'failed') {
        break;
      }
    }
    await Future.delayed(const Duration(seconds: 3));
  }
}
```

---

#### 12. 实时进度流 (SSE)

**GET** `/api/workflows/{id}/stream`

使用 Server-Sent Events (SSE) 实时获取工作流进度。

**事件类型:**

| 事件 | 说明 |
|------|------|
| `started` | 工作流节点开始执行 |
| `progress` | 节点完成，进度更新 |
| `completed` | 整个工作流完成 |
| `error` | 工作流失败 |

**Flutter SSE 客户端示例:**

```dart
// lib/services/sse_service.dart
import 'package:eventsource/eventsource.dart';

class SSEService {
  EventSource? _eventSource;

  // 监听工作流进度
  Stream<Map<String, dynamic>> listenToWorkflow(String workflowId) async* {
    final url = '$baseUrl/api/workflows/$workflowId/stream';

    _eventSource = await EventSource.connect(Uri.parse(url));

    await for (final event in _eventSource!) {
      final data = jsonDecode(event.data!);
      yield {
        'event': event.event,
        'data': data,
      };

      // 如果工作流完成或失败，关闭连接
      if (event.event == 'completed' || event.event == 'error') {
        disconnect();
      }
    }
  }

  void disconnect() {
    _eventSource?.close();
    _eventSource = null;
  }
}

// 使用示例
void monitorWorkflow(String workflowId) {
  final sseService = SSEService();
  sseService.listenToWorkflow(workflowId).listen((event) {
    print('Event: ${event['event']}');
    print('Data: ${event['data']}');

    if (event['event'] == 'completed') {
      // 工作流完成，刷新 UI
      print('分析完成！');
    }
  });
}
```

---

#### 13. 获取分析结果

**GET** `/api/analysis/{id}`

获取特定分析结果的详细信息。

**响应示例:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "bookId": "uuid",
    "workflowId": "uuid",
    "analysisType": "theme",  // summary, theme, quote, philosophy, emotion, etc.
    "chunkIndex": null,  // null 表示聚合结果
    "result": { ... },  // 分析结果
    "createdAt": "2026-06-12T10:15:00.000Z",
    "isAggregated": true,
    "workflow": {
      "id": "uuid",
      "status": "completed",
      "progress": 1.0,
      "startedAt": "2026-06-12T10:00:00.000Z",
      "completedAt": "2026-06-12T10:30:00.000Z"
    }
  }
}
```

---

### 支付系统

#### 14. 提交支付订单

**POST** `/api/payments/submit`

提交会员购买订单（需要认证）。

**请求参数:** `multipart/form-data`

| 参数 | 类型 | 说明 |
|------|------|------|
| `tier` | string | 会员类型：monthly, quarterly, yearly |
| `proof` | file | 付款截图（最大 5MB） |

**价格表:**

| 会员类型 | 价格（分） | 价格（元） | 时长 |
|---------|-----------|-----------|------|
| monthly | 5900 | ¥59 | 1 个月 |
| quarterly | 15900 | ¥159 | 3 个月 |
| yearly | 65900 | ¥659 | 12 个月 |

**响应示例:**

```json
{
  "success": true,
  "data": {
    "message": "订单已提交，等待管理员审核"
  }
}
```

**Flutter 示例:**

```dart
// lib/services/payment_service.dart
import 'package:http/http.dart' as http;

Future<ApiResponse<Map<String, dynamic>>> submitPayment({
  required String tier,
  required String proofFilePath,
}) async {
  final token = await AuthService.getToken();
  final uri = Uri.parse('$baseUrl/api/payments/submit');

  final request = http.MultipartRequest('POST', uri);

  // 添加认证头
  if (token != null) {
    request.headers['Authorization'] = 'Bearer $token';
  }

  // 添加表单字段
  request.fields['tier'] = tier;

  // 添加文件
  request.files.add(
    await http.MultipartFile.fromPath('proof', proofFilePath),
  );

  final streamedResponse = await request.send();
  final response = await http.Response.fromStream(streamedResponse);

  final json = jsonDecode(response.body);
  return ApiResponse.fromJson(json, (data) => data as Map<String, dynamic>);
}
```

---

### 管理后台

> **注意**: 管理后台 API 需要管理员权限，通常需要提供 `ADMIN_KEY`。

#### 15. 验证管理员密钥

**POST** `/api/admin/verify`

验证管理员密钥。

**请求参数:**

```json
{
  "key": "string"  // 管理员密钥
}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "verified": true
  }
}
```

---

#### 16. 获取支付订单列表

**GET** `/api/admin/orders`

获取支付订单列表（需要管理员权限）。

**请求头:**

```
Authorization: Bearer {admin_key}
```

**查询参数:**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `status` | string | pending | 订单状态：pending, approved, rejected |

**响应示例:**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "uuid",
        "userId": "uuid",
        "tier": "monthly",
        "amount": 5900,
        "proofUrl": "/uploads/proof.png",
        "status": "pending",
        "adminNote": null,
        "createdAt": "2026-06-12T10:00:00.000Z",
        "approvedAt": null
      }
    ]
  }
}
```

---

#### 17. 审批支付订单

**POST** `/api/admin/approve`

审批或拒绝支付订单（需要管理员权限）。

**请求参数:**

```json
{
  "orderId": "uuid",
  "action": "approve",  // approve 或 reject
  "adminKey": "string"
}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "message": "已激活会员",
    "tier": "monthly",
    "expiresAt": "2026-07-12T00:00:00.000Z"
  }
}
```

---

## Flutter 集成示例

### 完整的 API 服务类

```dart
// lib/services/api_service.dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class ApiService {
  static const String baseUrl = 'https://your-api-domain.com';

  final http.Client _client;

  ApiService({http.Client? client}) : _client = client ?? http.Client();

  // 通用请求方法
  Future<ApiResponse<T>> request<T>({
    required String method,
    required String endpoint,
    Map<String, String>? headers,
    Map<String, dynamic>? body,
    T Function(dynamic)? fromJsonT,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');

    http.Response response;
    switch (method.toUpperCase()) {
      case 'GET':
        response = await _client.get(uri, headers: headers);
        break;
      case 'POST':
        response = await _client.post(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case 'PATCH':
        response = await _client.patch(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case 'DELETE':
        response = await _client.delete(uri, headers: headers);
        break;
      default:
        throw UnsupportedError('Unsupported HTTP method: $method');
    }

    final json = jsonDecode(response.body);
    return ApiResponse.fromJson(json, fromJsonT);
  }

  // 带认证的请求
  Future<ApiResponse<T>> authRequest<T>({
    required String method,
    required String endpoint,
    Map<String, dynamic>? body,
    T Function(dynamic)? fromJsonT,
  }) async {
    final token = await AuthService.getToken();
    final headers = await ApiConfig.getAuthHeaders(token);

    return request<T>(
      method: method,
      endpoint: endpoint,
      headers: headers,
      body: body,
      fromJsonT: fromJsonT,
    );
  }

  void dispose() {
    _client.close();
  }
}
```

### 数据模型示例

```dart
// lib/models/book.dart
class Book {
  final String id;
  final String title;
  final String? author;
  final String status;
  final int chunkCount;
  final bool isPublic;
  final String createdAt;
  final String? updatedAt;

  Book({
    required this.id,
    required this.title,
    this.author,
    required this.status,
    required this.chunkCount,
    required this.isPublic,
    required this.createdAt,
    this.updatedAt,
  });

  factory Book.fromJson(Map<String, dynamic> json) {
    return Book(
      id: json['id'],
      title: json['title'],
      author: json['author'],
      status: json['status'],
      chunkCount: json['chunkCount'] ?? 0,
      isPublic: json['isPublic'] ?? false,
      createdAt: json['createdAt'],
      updatedAt: json['updatedAt'],
    );
  }
}

// lib/models/analysis_result.dart
class AnalysisResult {
  final String id;
  final String bookId;
  final String analysisType;
  final Map<String, dynamic> result;
  final String createdAt;

  AnalysisResult({
    required this.id,
    required this.bookId,
    required this.analysisType,
    required this.result,
    required this.createdAt,
  });

  factory AnalysisResult.fromJson(Map<String, dynamic> json) {
    return AnalysisResult(
      id: json['id'],
      bookId: json['bookId'],
      analysisType: json['analysisType'],
      result: json['result'],
      createdAt: json['createdAt'],
    );
  }
}
```

---

## 数据类型定义

### 书籍状态 (BookStatus)

```dart
enum BookStatus {
  uploaded,    // 已上传，待分析
  analyzing,   // 分析中
  completed,   // 分析完成
  failed,      // 分析失败
}
```

### 工作流状态 (WorkflowStatus)

```dart
enum WorkflowStatus {
  pending,    // 等待执行
  running,    // 执行中
  completed,  // 已完成
  failed,     // 失败
}
```

### 会员类型 (MembershipTier)

```dart
enum MembershipTier {
  free,       // 免费用户（3 本/月）
  monthly,    // 月度会员
  quarterly,  // 季度会员
  yearly,     // 年度会员
}
```

### 分析类型 (AnalysisType)

```dart
enum AnalysisType {
  summary,        // 摘要
  theme,          // 主题
  quote,         // 金句
  philosophy,     // 哲学
  emotion,        // 情感
  character,      // 人物
  psychology,     // 心理
  sociology,      // 社会学
  politicalEconomy, // 政治经济学
  literaryCritic,   // 文学评论
  religious,      // 宗教与精神
}
```

---

## 附录

### 常用代码片段

#### 1. 检查并刷新 Token

```dart
Future<bool> ensureAuthenticated() async {
  final isLoggedIn = await AuthService.isLoggedIn();
  if (!isLoggedIn) return false;

  // 验证 token 是否有效
  final response = await getCurrentUser();
  if (!response.success) {
    // Token 无效，清除本地存储
    await AuthService.clearToken();
    return false;
  }
  return true;
}
```

#### 2. 错误处理的统一方式

```dart
void handleApiError(ApiError error) {
  switch (error.code) {
    case 'UNAUTHORIZED':
      // 跳转到登录页
      break;
    case 'QUOTA_EXCEEDED':
      // 显示升级会员对话框
      break;
    case 'NOT_FOUND':
      // 显示资源不存在提示
      break;
    default:
      // 显示通用错误提示
      print('API Error: ${error.message}');
  }
}
```

#### 3. 轮询工作流进度的 Widget

```dart
// lib/widgets/workflow_progress.dart
import 'package:flutter/material.dart';

class WorkflowProgressWidget extends StatefulWidget {
  final String workflowId;

  const WorkflowProgressWidget({required this.workflowId});

  @override
  _WorkflowProgressWidgetState createState() => _WorkflowProgressWidgetState();
}

class _WorkflowProgressWidgetState extends State<WorkflowProgressWidget> {
  @override
  void initState() {
    super.initState();
    _startPolling();
  }

  void _startPolling() {
    // 使用前面定义的 pollWorkflowStatus 方法
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<Map<String, dynamic>>(
      stream: pollWorkflowStatus(widget.workflowId),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return CircularProgressIndicator();
        }

        final workflow = snapshot.data!;
        final progress = workflow['progress'] ?? 0.0;

        return Column(
          children: [
            LinearProgressIndicator(value: progress),
            Text('${(progress * 100).toStringAsFixed(0)}%'),
          ],
        );
      },
    );
  }
}
```

---

## 更新日志

- **2026-06-12**: 初始版本创建，包含完整的 API 文档和 Flutter 集成示例
