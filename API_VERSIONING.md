# API Versioning Implementation

## Summary

Added API versioning to the Ajosave project to support backward compatibility and future API evolution.

## Changes Made

### 1. API Structure
- **New versioned endpoints**: All API routes moved to `/api/v1/`
- **Backward compatibility**: Legacy `/api/` routes redirect to `/api/v1/` with deprecation headers
- **Middleware-based redirects**: Automatic redirection handled in `src/middleware.ts`

### 2. Redirect Behavior
- **GET requests**: 301 (Moved Permanently) redirect
- **POST/PUT/DELETE/PATCH**: 308 (Permanent Redirect) to preserve HTTP method
- **Deprecation headers**: 
  - `X-API-Deprecated: true`
  - `X-API-Deprecation-Info: This endpoint is deprecated. Use /api/v1/{endpoint} instead.`

### 3. Documentation Updates
- **OpenAPI spec**: Updated to reflect v1 versioning with new base URLs
- **API docs**: Now served at `/api/v1/docs` with updated title and spec URL
- **Version info**: Added versioning section to API documentation

### 4. Exception Handling
- **Auth routes**: NextAuth routes (`/api/auth/`) are excluded from automatic redirection to avoid breaking authentication flow

## Usage

### New API Endpoints (Recommended)
```
GET /api/v1/circles
POST /api/v1/circles
GET /api/v1/health
```

### Legacy Endpoints (Deprecated)
```
GET /api/circles → redirects to /api/v1/circles
POST /api/circles → redirects to /api/v1/circles  
GET /api/health → redirects to /api/v1/health
```

## Testing

To test the implementation:

1. **Check v1 endpoints work**:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```

2. **Verify redirects**:
   ```bash
   curl -I http://localhost:3000/api/health
   # Should return 301 with Location: /api/v1/health
   ```

3. **Check deprecation headers**:
   ```bash
   curl -I http://localhost:3000/api/circles
   # Should include X-API-Deprecated: true
   ```

## Future Considerations

- When introducing breaking changes, create `/api/v2/` 
- Consider sunset timeline for v1 deprecation
- Monitor usage of legacy endpoints via deprecation headers
