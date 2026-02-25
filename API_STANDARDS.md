# API Standards

## Supabase Client Usage

### Client-Side (Browser)
```typescript
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();
```

### Server-Side (API Routes)
```typescript
import { createClient } from '@/utils/supabase/server';

const supabase = await createClient();
```

### Middleware
```typescript
import { updateSession } from '@/utils/supabase/middleware';
```

## API Response Standards

### Success Response Format
```typescript
{
  success: true,
  data: {
    // actual data here
  }
}
```

### Error Response Format
```typescript
{
  success: false,
  error: "Error message",
  details?: "Additional error details"
}
```

## Authentication

### Server Actions
```typescript
import { signInWithGoogle, signOut } from '@/actions/auth';
```

### API Routes
Always check authentication in API routes:
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

## Common API Endpoints

### Balance
- **GET** `/api/balance?teamId={teamId}`
- Returns: `{ success: true, data: { availableBalance: number } }`

### Expendables
- **GET** `/api/expendables?teamId={teamId}`
- Returns: `{ success: true, data: { expendables: string[] } }`

### Team Data
- **GET** `/api/team/{teamId}` - Get team by ID
- **GET** `/api/user/team/{leagueId}` - Get user's team in league
- **GET** `/api/league/teams?leagueId={leagueId}` - Get all teams in league

## Error Handling

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (missing parameters)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (not authorized for resource)
- `404` - Not Found
- `500` - Internal Server Error

### Error Response Example
```typescript
return NextResponse.json({ 
  success: false,
  error: 'Team not found',
  details: error instanceof Error ? error.message : 'Unknown error'
}, { status: 404 });
```

## Deprecated Patterns (Do Not Use)

### ❌ Old Supabase Client
```typescript
// DO NOT USE
import { supabase } from '@/lib/supabaseClient';
```

### ❌ Auth Helpers NextJS
```typescript
// DO NOT USE
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
```

### ❌ Inconsistent Response Formats
```typescript
// DO NOT USE - inconsistent
return NextResponse.json({ data: result });
return NextResponse.json({ result: data });
return NextResponse.json({ availableBalance: balance });
``` 