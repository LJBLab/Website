---
title: "Solving Blazor 8's Authentication Crisis: How a Week of Frustration Led to a Production-Ready Solution"
excerpt: "Discover how a week-long struggle with Blazor 8's hybrid rendering authentication led to a production-ready solution that handles JWT tokens across all render modes."
publishDate: 2024-08-19T00:00:00.000Z
image: ~/assets/images/blazor-auth-crisis.jpg
category: Development
tags:
  - Blazor
  - Authentication
  - .NET 8
  - JWT
  - Enterprise Development
metadata:
  canonical: https://ljblab.dev/blog/solving-blazor-8-authentication-crisis
author: Lincoln J Bicalho
draft: false
---

> 📋 **Prerequisites**:
> - .NET 8 SDK or later
> - Understanding of JWT authentication concepts
> - Basic knowledge of Blazor render modes (SSR, Server, WebAssembly)
> - Visual Studio 2022 or VS Code with C# extension
> - Experience with ASP.NET Core dependency injection

## Overview

"JavaScript interop calls cannot be issued at this time."

This error message in Blazor 8 reveals a fundamental challenge with hybrid rendering: managing authentication tokens across different rendering modes. When you implement JWT authentication for enterprise applications, you quickly discover that standard approaches fail because they assume client-side storage is always available.

**The core challenge:**
During prerendering, there's no JavaScript runtime, no access to localStorage, and the HTTP response has already started streaming. Your authentication token management must work seamlessly across Server-Side Rendering (SSR), Blazor Server, WebAssembly, and Auto modes—often within the same application.

**What you'll learn:**
- Why traditional authentication approaches fail in Blazor 8's hybrid rendering
- How to implement a hybrid storage strategy that works across all render modes
- Production-ready code for managing JWT tokens in enterprise environments
- Common pitfalls and how to avoid them
- Real-world results from federal government systems

> ℹ️ **Note**: While this implementation was developed for federal government systems handling sensitive data, the patterns apply to any enterprise Blazor application requiring reliable authentication.

## Understanding the Problem

### The New Blazor 8 Reality

When Microsoft released Blazor 8, they introduced hybrid rendering modes that let you mix Server-Side Rendering (SSR), Blazor Server, WebAssembly, and Auto modes in a single application. This flexibility is powerful for building modern web applications, but it fundamentally changes how you handle authentication state.

**Why traditional approaches fail:**

| Approach | Problem | When It Fails |
|----------|---------|---------------|
| localStorage | No JavaScript during prerendering | SSR and initial Server render |
| Session storage | Response already started streaming | After prerendering begins |
| Cookies only | State sync issues across render modes | Mode transitions |
| Client-side only | Not available server-side | SSR and Server mode |

### The Three Critical Timing Issues

**1. Prerendering Complications**

During prerendering, there's no JavaScript runtime. You cannot call any browser APIs:

```csharp
// ❌ PROBLEM: This throws during server-side prerendering
protected override async Task OnInitializedAsync()
{
    // ERROR: "JavaScript interop calls cannot be issued at this time"
    var token = await JSRuntime.InvokeAsync<string>("localStorage.getItem", "token");
}
```

> ⚠️ **Warning**: Any attempt to use JavaScript interop during prerendering will crash your application with a runtime exception. This includes localStorage, sessionStorage, and custom JavaScript functions.

**2. Session State Timing Issues**

The HTTP response starts streaming before you can write to the session in many scenarios:

```csharp
// ❌ PROBLEM: Session write after response has started
public async Task<IActionResult> Login([FromBody] LoginRequest request)
{
    var token = await AuthenticateUser(request);

    // This throws if response has started
    // System.InvalidOperationException: The session cannot be established after the response has started
    HttpContext.Session.SetString("token", token);

    return Ok(new { token });
}
```

**3. Navigation Exceptions**

Using `NavigationManager.NavigateTo()` with `forceLoad: true` during prerendering causes exceptions:

```csharp
// ❌ PROBLEM: Navigation during prerendering
protected override async Task OnInitializedAsync()
{
    if (!isAuthenticated)
    {
        // ERROR: "Navigation commands cannot be issued during server-side prerendering"
        NavigationManager.NavigateTo("/login", forceLoad: true);
    }
}
```

### The Business Impact

In federal government systems handling sensitive data for millions of visitors annually, these issues prevented deployment entirely. Authentication must work reliably across all scenarios without exceptions.

Before finding the solution, our authentication issues were causing:
- Significant delays on initial page loads
- Users experiencing authentication loops
- Substantial time spent on support tickets
- Failed security audits due to inconsistent token handling

> 💡 **Tip**: The key insight is that Blazor 8's hybrid rendering requires a hybrid storage strategy. Instead of relying on a single storage mechanism, your solution must use multiple fallback layers that adapt to the current rendering context.

## The Hybrid Storage Solution

### Concept Overview

The solution works by implementing an intelligent token service that:

1. **Detects the current rendering context** - Is JavaScript available? Has the response started?
2. **Chooses the appropriate storage mechanism** - Session, cookies, or localStorage based on context
3. **Provides seamless fallbacks** - Automatically switches storage methods when one isn't available
4. **Synchronizes state across modes** - Ensures tokens are available regardless of render mode transitions

**Why this approach works:**
- Addresses the root cause of timing issues
- Handles all edge cases automatically
- Scales to enterprise requirements
- Maintains security best practices

### Storage Strategy Comparison

| Storage Type | Availability | Persistence | Security | Best For |
|--------------|-------------|-------------|----------|----------|
| **Session** | Server-side only | Until session expires | High (server-only) | Primary server-side storage |
| **Secure Cookies** | Server and client | Configurable (days/weeks) | High (HttpOnly, Secure) | Cross-mode persistence |
| **localStorage** | Client-side only | Until cleared | Medium (client-accessible) | WebAssembly mode |
| **Database** | All contexts | Permanent | Highest | Audit requirements |

> ℹ️ **Note**: Our implementation uses a combination of session (fast), cookies (persistent), and localStorage (client-side) for maximum compatibility and performance.

## Implementation Guide

### Step 1: Define the Token Service Interface

First, you define the contract for token management that works across all contexts:

```csharp
// FILE: Services/IAuthTokenService.cs
// PURPOSE: Define authentication token management contract
public interface IAuthTokenService
{
    // WHY: Async to support both sync (session) and async (JS interop) storage
    ValueTask<string?> GetTokenAsync();

    // WHY: Separate refresh token management for security best practices
    ValueTask<string?> GetRefreshTokenAsync();

    // WHY: Atomic operation ensures both tokens are set together
    ValueTask SetTokensAsync(string? token, string? refreshToken);

    // WHY: Clear operation for logout functionality
    ValueTask ClearTokensAsync();

    // WHY: Exposes rendering state for conditional logic in components
    bool IsPrerendering { get; }
}
```

### Step 2: Implement the Hybrid Token Service

This is where the magic happens—intelligent storage selection based on context:

```csharp
// FILE: Services/HybridAuthTokenService.cs
// PURPOSE: Implement multi-layered token storage with automatic fallback
public class HybridAuthTokenService : IAuthTokenService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IJSRuntime _jsRuntime;
    private readonly ILogger<HybridAuthTokenService> _logger;

    public HybridAuthTokenService(
        IHttpContextAccessor httpContextAccessor,
        IJSRuntime jsRuntime,
        ILogger<HybridAuthTokenService> logger)
    {
        _httpContextAccessor = httpContextAccessor;
        _jsRuntime = jsRuntime;
        _logger = logger;
    }

    // WHY: Check response state to determine if we're still prerendering
    // HOW: Response.HasStarted is false during prerendering, true after
    public bool IsPrerendering =>
        _httpContextAccessor.HttpContext?.Response.HasStarted == false;

    public async ValueTask<string?> GetTokenAsync()
    {
        try
        {
            // STEP 1: Try server-side storage first (fastest, most reliable)
            var context = _httpContextAccessor.HttpContext;
            if (context != null)
            {
                // WHY: Check session first - it's the fastest option
                // HOW: Session is available immediately on server
                var sessionToken = context.Session.GetString("auth_token");
                if (!string.IsNullOrEmpty(sessionToken))
                {
                    _logger.LogDebug("Token retrieved from session");
                    return sessionToken;
                }

                // WHY: Check secure cookie as fallback - persists across requests
                // HOW: Cookies are sent with every request automatically
                if (context.Request.Cookies.TryGetValue("auth_token", out var cookieToken))
                {
                    _logger.LogDebug("Token retrieved from cookie");
                    return cookieToken;
                }
            }

            // STEP 2: If not prerendering, try client-side storage
            // WHY: WebAssembly mode might have token in localStorage
            // HOW: Check if JavaScript runtime is available first
            if (!IsPrerendering && _jsRuntime is IJSInProcessRuntime)
            {
                try
                {
                    var localToken = await _jsRuntime.InvokeAsync<string?>(
                        "localStorage.getItem", "auth_token");

                    if (!string.IsNullOrEmpty(localToken))
                    {
                        _logger.LogDebug("Token retrieved from localStorage");
                        return localToken;
                    }
                }
                catch (InvalidOperationException ex)
                {
                    // WHY: JavaScript interop might not be available yet
                    // HOW: Fall back to server storage gracefully
                    _logger.LogDebug(ex, "JS interop not available, using server storage");
                }
            }

            _logger.LogWarning("No authentication token found in any storage");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving authentication token");
            return null;
        }
    }

    public async ValueTask<string?> GetRefreshTokenAsync()
    {
        try
        {
            var context = _httpContextAccessor.HttpContext;
            if (context != null)
            {
                // WHY: Same pattern as GetTokenAsync for consistency
                var sessionToken = context.Session.GetString("refresh_token");
                if (!string.IsNullOrEmpty(sessionToken))
                    return sessionToken;

                if (context.Request.Cookies.TryGetValue("refresh_token", out var cookieToken))
                    return cookieToken;
            }

            if (!IsPrerendering && _jsRuntime is IJSInProcessRuntime)
            {
                try
                {
                    return await _jsRuntime.InvokeAsync<string?>(
                        "localStorage.getItem", "refresh_token");
                }
                catch (InvalidOperationException)
                {
                    _logger.LogDebug("JS interop not available for refresh token");
                }
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving refresh token");
            return null;
        }
    }

    public async ValueTask SetTokensAsync(string? token, string? refreshToken)
    {
        var context = _httpContextAccessor.HttpContext;
        if (context == null)
        {
            _logger.LogWarning("HttpContext not available for token storage");
            return;
        }

        try
        {
            // STEP 1: Store in session if response hasn't started
            // WHY: Session is fastest for subsequent requests in same circuit
            // HOW: Check Response.HasStarted to avoid exceptions
            if (!context.Response.HasStarted)
            {
                context.Session.SetString("auth_token", token ?? "");
                if (refreshToken != null)
                    context.Session.SetString("refresh_token", refreshToken);

                _logger.LogDebug("Tokens stored in session");
            }
            else
            {
                _logger.LogDebug("Response started, skipping session storage");
            }

            // STEP 2: Always set secure cookie for persistence
            // WHY: Cookies persist across server restarts and browser refresh
            // HOW: Use strict security settings for token protection
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,      // Prevents JavaScript access
                Secure = true,        // HTTPS only
                SameSite = SameSiteMode.Strict,  // CSRF protection
                Expires = DateTimeOffset.UtcNow.AddDays(7)
            };

            context.Response.Cookies.Append("auth_token", token ?? "", cookieOptions);
            if (refreshToken != null)
                context.Response.Cookies.Append("refresh_token", refreshToken, cookieOptions);

            _logger.LogDebug("Tokens stored in cookies");

            // STEP 3: Store in localStorage if available (for WASM scenarios)
            // WHY: WebAssembly components need client-side token access
            // HOW: Safely attempt JS interop with exception handling
            if (!IsPrerendering && _jsRuntime is IJSInProcessRuntime)
            {
                try
                {
                    await _jsRuntime.InvokeVoidAsync("localStorage.setItem",
                        "auth_token", token ?? "");
                    if (refreshToken != null)
                    {
                        await _jsRuntime.InvokeVoidAsync("localStorage.setItem",
                            "refresh_token", refreshToken);
                    }
                    _logger.LogDebug("Tokens stored in localStorage");
                }
                catch (InvalidOperationException ex)
                {
                    // WHY: Expected during prerendering or if JS not available
                    // HOW: Already stored in session/cookies, so this is non-critical
                    _logger.LogDebug(ex, "Could not store in localStorage");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error storing authentication tokens");
        }
    }

    public async ValueTask ClearTokensAsync()
    {
        try
        {
            var context = _httpContextAccessor.HttpContext;
            if (context != null)
            {
                // Clear session
                if (!context.Response.HasStarted)
                {
                    context.Session.Remove("auth_token");
                    context.Session.Remove("refresh_token");
                }

                // Clear cookies
                context.Response.Cookies.Delete("auth_token");
                context.Response.Cookies.Delete("refresh_token");
            }

            // Clear localStorage
            if (!IsPrerendering && _jsRuntime is IJSInProcessRuntime)
            {
                try
                {
                    await _jsRuntime.InvokeVoidAsync("localStorage.removeItem", "auth_token");
                    await _jsRuntime.InvokeVoidAsync("localStorage.removeItem", "refresh_token");
                }
                catch (InvalidOperationException)
                {
                    // Expected during prerendering
                }
            }

            _logger.LogInformation("Authentication tokens cleared from all storage");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error clearing authentication tokens");
        }
    }
}
```

> 💡 **Tip**: Notice the layered approach—we try session first (fastest), then cookies (persistent), then localStorage (client-side). This ensures optimal performance while maintaining reliability.

### Step 3: Implement Custom Authentication State Provider

The authentication state provider integrates with Blazor's authentication system:

```csharp
// FILE: Services/CustomAuthStateProvider.cs
// PURPOSE: Provide authentication state to Blazor components
public class CustomAuthStateProvider : AuthenticationStateProvider
{
    private readonly IAuthTokenService _tokenService;
    private readonly ILogger<CustomAuthStateProvider> _logger;

    public CustomAuthStateProvider(
        IAuthTokenService tokenService,
        ILogger<CustomAuthStateProvider> logger)
    {
        _tokenService = tokenService;
        _logger = logger;
    }

    public override async Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        try
        {
            // STEP 1: Get token from hybrid storage
            var token = await _tokenService.GetTokenAsync();

            if (string.IsNullOrEmpty(token))
            {
                _logger.LogDebug("No token found, returning anonymous user");
                return new AuthenticationState(
                    new ClaimsPrincipal(new ClaimsIdentity()));
            }

            // STEP 2: Parse JWT without external libraries
            // WHY: Reduces dependencies and improves performance
            // HOW: Manual base64 decoding of JWT payload
            var claims = ParseClaimsFromJwt(token);

            // STEP 3: Check token expiration
            // WHY: Prevents using expired tokens
            // HOW: Check 'exp' claim against current time
            var expClaim = claims.FirstOrDefault(c => c.Type == "exp");
            if (expClaim != null)
            {
                var expTime = DateTimeOffset.FromUnixTimeSeconds(
                    long.Parse(expClaim.Value));

                if (expTime < DateTimeOffset.UtcNow)
                {
                    _logger.LogWarning("Token expired at {ExpirationTime}", expTime);
                    await _tokenService.ClearTokensAsync();
                    return new AuthenticationState(
                        new ClaimsPrincipal(new ClaimsIdentity()));
                }
            }

            // STEP 4: Create authenticated user
            var identity = new ClaimsIdentity(claims, "jwt");
            var user = new ClaimsPrincipal(identity);

            _logger.LogDebug("User authenticated: {UserName}",
                user.Identity?.Name ?? "Unknown");

            return new AuthenticationState(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting authentication state");
            return new AuthenticationState(
                new ClaimsPrincipal(new ClaimsIdentity()));
        }
    }

    // WHY: Parse JWT manually to avoid external dependencies
    // HOW: Split token, decode base64 payload, deserialize JSON
    private IEnumerable<Claim> ParseClaimsFromJwt(string jwt)
    {
        var payload = jwt.Split('.')[1];
        var jsonBytes = ParseBase64WithoutPadding(payload);
        var keyValuePairs = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonBytes);

        return keyValuePairs?.Select(kvp => new Claim(kvp.Key, kvp.Value.ToString() ?? ""))
            ?? Enumerable.Empty<Claim>();
    }

    // WHY: JWT base64 encoding doesn't include padding characters
    // HOW: Add padding based on string length modulo 4
    private byte[] ParseBase64WithoutPadding(string base64)
    {
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }
        return Convert.FromBase64String(base64);
    }

    // WHY: Allow components to trigger authentication state refresh
    // HOW: Call this after login/logout operations
    public void NotifyAuthenticationStateChanged()
    {
        NotifyAuthenticationStateChanged(GetAuthenticationStateAsync());
    }
}
```

### Step 4: Configure Services and Middleware

The configuration order is critical for proper operation:

```csharp
// FILE: Program.cs
// PURPOSE: Configure authentication services and middleware pipeline
var builder = WebApplication.CreateBuilder(args);

// STEP 1: Add session BEFORE other services
// WHY: Session must be available when authentication services initialize
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;       // Security: Prevent JavaScript access
    options.Cookie.IsEssential = true;    // GDPR: Mark as essential for functionality
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;  // HTTPS only
});

// STEP 2: Register authentication services
// WHY: Register in correct order for dependency injection
builder.Services.AddScoped<IAuthTokenService, HybridAuthTokenService>();
builder.Services.AddScoped<CustomAuthStateProvider>();
builder.Services.AddScoped<AuthenticationStateProvider>(provider =>
    provider.GetRequiredService<CustomAuthStateProvider>());

// STEP 3: Add Blazor services with all render modes
// WHY: Enables hybrid rendering across Server, WASM, and SSR
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddInteractiveWebAssemblyComponents();

// STEP 4: Add required infrastructure services
builder.Services.AddHttpContextAccessor();  // Required for IAuthTokenService
builder.Services.AddAuthorizationCore();     // Required for [Authorize] attribute

var app = builder.Build();

// MIDDLEWARE ORDER IS CRITICAL
// WHY: Middleware executes in the order it's added

app.UseSession();        // MUST be before authentication
app.UseAuthentication(); // MUST be before authorization
app.UseAuthorization();  // MUST be before endpoints
app.UseAntiforgery();    // CSRF protection

// STEP 5: Map Blazor components with all render modes
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(typeof(Client._Imports).Assembly);

app.Run();
```

> ⚠️ **Warning**: The middleware order shown above is critical. Changing the order will cause authentication to fail or introduce security vulnerabilities.

## Render Mode Compatibility Matrix

| Feature | SSR | Server | WASM | Auto |
|---------|-----|--------|------|------|
| Session Storage | ✅ | ✅ | ❌ | ✅* |
| Cookie Storage | ✅ | ✅ | ✅ | ✅ |
| localStorage | ❌ | ⚠️** | ✅ | ✅ |
| Token Refresh | ✅ | ✅ | ✅ | ✅ |

*✅ Auto mode uses best available option
**⚠️ Available after prerendering completes

## Troubleshooting Guide

### Issue 1: JavaScript Interop Error During Prerendering

**Symptoms:**
```
System.InvalidOperationException: JavaScript interop calls cannot be issued at this time.
This is because the component is being statically rendered.
When prerendering in Blazor Server, JavaScript interop calls cannot be issued.

Stack trace:
   at Microsoft.AspNetCore.Components.Server.Circuits.RemoteJSRuntime.BeginInvokeJS(...)
   at Microsoft.JSInterop.JSRuntime.InvokeAsync[TValue](...)
```

**Cause:**
Your code is attempting to call JavaScript during server-side prerendering when no JavaScript runtime is available.

**Solution:**

```csharp
// ✅ SOLUTION: Use OnAfterRenderAsync instead of OnInitializedAsync
protected override async Task OnAfterRenderAsync(bool firstRender)
{
    // WHY: OnAfterRenderAsync runs after prerendering is complete
    if (firstRender && !_tokenService.IsPrerendering)
    {
        // Safe to use JavaScript interop here
        var token = await JSRuntime.InvokeAsync<string>(
            "localStorage.getItem", "token");

        // Process token...
        StateHasChanged();  // Trigger re-render with new data
    }
}
```

> 💡 **Tip**: Always check `IsPrerendering` before attempting JavaScript interop, even in `OnAfterRenderAsync`.

### Issue 2: Session Write After Response Started

**Symptoms:**
```
System.InvalidOperationException: The session cannot be established after the response has started.
   at Microsoft.AspNetCore.Session.SessionMiddleware.CheckSessionStateAsync(...)
```

**Cause:**
You're trying to write to the session after the HTTP response has already started streaming to the client.

**Solution:**

```csharp
// ✅ SOLUTION: Check Response.HasStarted before session operations
public async Task<IActionResult> Login([FromBody] LoginRequest request)
{
    var token = await AuthenticateUser(request);

    // WHY: Check if we can still write to session
    if (!HttpContext.Response.HasStarted)
    {
        HttpContext.Session.SetString("token", token);
    }
    else
    {
        _logger.LogWarning("Response started, session write skipped");
    }

    // WHY: Always set cookie as backup storage
    HttpContext.Response.Cookies.Append("token", token, new CookieOptions
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Expires = DateTimeOffset.UtcNow.AddDays(7)
    });

    return Ok(new { token });
}
```

### Issue 3: Authentication State Not Updating

**Symptoms:**
- User logs in successfully but UI still shows as not authenticated
- Authorization checks fail even with valid token
- Navigation to protected pages is blocked

**Cause:**
The authentication state provider hasn't been notified of the state change.

**Solution:**

```csharp
// ✅ SOLUTION: Notify state changed after login/logout
public class LoginComponent : ComponentBase
{
    [Inject] private CustomAuthStateProvider AuthStateProvider { get; set; } = null!;
    [Inject] private IAuthTokenService TokenService { get; set; } = null!;

    private async Task HandleLogin(LoginModel model)
    {
        // Perform login
        var result = await AuthService.LoginAsync(model);

        if (result.Success)
        {
            // Store tokens
            await TokenService.SetTokensAsync(result.Token, result.RefreshToken);

            // WHY: Notify Blazor that authentication state changed
            // HOW: This triggers re-evaluation of [Authorize] and AuthorizeView
            AuthStateProvider.NotifyAuthenticationStateChanged();

            // Navigate to protected page
            NavigationManager.NavigateTo("/dashboard");
        }
    }
}
```

### Issue 4: Cookies Not Persisting Across Requests

**Symptoms:**
- Authentication works initially but fails on page refresh
- User has to log in again after closing browser
- Cookies appear in developer tools but aren't sent with requests

**Cause:**
Incorrect cookie configuration or domain/path mismatch.

**Solution:**

```csharp
// ✅ SOLUTION: Proper cookie configuration
var cookieOptions = new CookieOptions
{
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Strict,

    // WHY: Set appropriate expiration for your use case
    Expires = DateTimeOffset.UtcNow.AddDays(7),

    // WHY: Ensure cookie is available to all pages
    Path = "/",

    // WHY: Only set domain if needed for subdomains
    // Domain = ".yourdomain.com"  // Uncomment for subdomain sharing

    // WHY: Mark as essential for GDPR compliance
    IsEssential = true
};

HttpContext.Response.Cookies.Append("auth_token", token, cookieOptions);
```

### Issue 5: Token Expiration Not Handled

**Symptoms:**
- API calls fail with 401 Unauthorized
- User stays "logged in" but can't access resources
- No automatic redirect to login page

**Cause:**
Expired tokens aren't being detected and cleared.

**Solution:**

```csharp
// ✅ SOLUTION: Implement token refresh or re-authentication
public class TokenRefreshService
{
    private readonly IAuthTokenService _tokenService;
    private readonly CustomAuthStateProvider _authStateProvider;
    private readonly HttpClient _httpClient;

    public async Task<bool> RefreshTokenIfNeededAsync()
    {
        var token = await _tokenService.GetTokenAsync();
        if (string.IsNullOrEmpty(token))
            return false;

        // WHY: Check if token is expired or about to expire
        var claims = ParseJwt(token);
        var expClaim = claims.FirstOrDefault(c => c.Type == "exp");

        if (expClaim != null)
        {
            var expTime = DateTimeOffset.FromUnixTimeSeconds(long.Parse(expClaim.Value));
            var timeUntilExpiry = expTime - DateTimeOffset.UtcNow;

            // WHY: Refresh if expiring within 5 minutes
            if (timeUntilExpiry.TotalMinutes < 5)
            {
                var refreshToken = await _tokenService.GetRefreshTokenAsync();
                if (!string.IsNullOrEmpty(refreshToken))
                {
                    // Call your token refresh endpoint
                    var response = await _httpClient.PostAsJsonAsync("/api/auth/refresh",
                        new { RefreshToken = refreshToken });

                    if (response.IsSuccessStatusCode)
                    {
                        var result = await response.Content.ReadFromJsonAsync<TokenResponse>();
                        await _tokenService.SetTokensAsync(result.Token, result.RefreshToken);
                        _authStateProvider.NotifyAuthenticationStateChanged();
                        return true;
                    }
                }

                // Refresh failed, clear tokens
                await _tokenService.ClearTokensAsync();
                _authStateProvider.NotifyAuthenticationStateChanged();
                return false;
            }
        }

        return true;
    }
}
```

## Common Questions (FAQ)

> ❓ **Why use multiple storage mechanisms instead of just one?**
>
> Blazor 8's hybrid render modes mean your component may execute on the server (during prerendering or in Server mode) or on the client (in WebAssembly mode). Each environment has access to different storage APIs. Using multiple storage mechanisms with intelligent fallbacks ensures your authentication works in all scenarios.

> ❓ **Does this approach work with Azure AD B2C or other identity providers?**
>
> Yes. This implementation handles the token storage layer, which is independent of your identity provider. Whether you're using Azure AD B2C, IdentityServer, Auth0, or a custom JWT provider, you still need to solve the storage challenge. Simply adapt the token acquisition code to work with your specific provider.

> ❓ **What about security? Is it safe to store tokens in cookies and localStorage?**
>
> The implementation uses industry-standard security practices:
> - Cookies are marked `HttpOnly` (prevents JavaScript access), `Secure` (HTTPS only), and `SameSite=Strict` (CSRF protection)
> - Tokens should be short-lived (15-60 minutes) with refresh tokens for extended sessions
> - localStorage is only used in WebAssembly mode where it's the standard approach
> - Session storage is server-side only, providing the highest security
>
> For sensitive government systems, consider adding encryption to cookie values and implementing IP validation.

> ❓ **How do I handle concurrent requests when tokens are being refreshed?**
>
> Implement a token refresh lock to prevent multiple simultaneous refresh attempts:
>
> ```csharp
> private static readonly SemaphoreSlim _refreshLock = new(1, 1);
>
> public async Task<string> EnsureValidTokenAsync()
> {
>     await _refreshLock.WaitAsync();
>     try
>     {
>         var token = await _tokenService.GetTokenAsync();
>         if (IsExpired(token))
>         {
>             token = await RefreshTokenAsync();
>         }
>         return token;
>     }
>     finally
>     {
>         _refreshLock.Release();
>     }
> }
> ```

> ❓ **Does this work with Blazor United (Auto mode)?**
>
> Yes. Auto mode is actually why this hybrid approach is necessary. Auto mode can start with SSR, upgrade to Server, and potentially switch to WebAssembly—all in a single user session. The hybrid storage strategy handles these transitions seamlessly.

## Production Results

After implementing this solution across our federal government systems, we observed substantial improvements in reliability and user experience.

**Performance improvements:**
- Authentication errors reduced dramatically
- Page load times improved significantly
- Support ticket volume decreased substantially
- Security audit compliance achieved on first attempt
- Successfully handling high-volume production traffic

The same solution is now running in production across 10+ government systems, processing substantial daily request volumes without JavaScript interop errors.

> ℹ️ **Note**: In our production environment, we handle systems with strict security requirements including FedRAMP and FISMA compliance. This implementation has passed multiple security audits.

## Key Takeaways

After wrestling with Blazor 8's authentication challenges, here's what I learned:

### ✅ Do These Things

1. **Embrace hybrid storage** - Don't fight Blazor's rendering model. Use multiple storage mechanisms that adapt to the context.

2. **Always check rendering state** - Before any operation, verify if you're prerendering and if the response has started:
   ```csharp
   if (!httpContext.Response.HasStarted && !IsPrerendering)
   {
       // Safe to perform operation
   }
   ```

3. **Use OnAfterRenderAsync for JavaScript** - Never call JavaScript interop in `OnInitializedAsync`:
   ```csharp
   protected override async Task OnAfterRenderAsync(bool firstRender)
   {
       if (firstRender && !IsPrerendering)
       {
           // JavaScript interop here
       }
   }
   ```

4. **Implement proper token expiration handling** - Check token expiration before using tokens and implement refresh logic.

5. **Test all render mode combinations** - Your solution must work in SSR, Server, WASM, and Auto modes simultaneously.

### ❌ Avoid These Mistakes

1. **Don't rely on a single storage mechanism** - Session-only, cookie-only, or localStorage-only approaches all fail in certain render modes.

2. **Don't assume JavaScript is always available** - It's not available during prerendering or in pure server-side scenarios.

3. **Don't ignore Response.HasStarted** - Attempting session writes after the response has started will crash your application.

4. **Don't forget to notify state changes** - Always call `NotifyAuthenticationStateChanged()` after login/logout operations.

### 💡 Additional Considerations

- **Logging is critical** - Add comprehensive logging to debug rendering mode transitions and storage fallbacks.
- **Plan for all scenarios** - Edge cases like browser refresh, multiple tabs, and session expiration need explicit handling.
- **Security first** - Use appropriate cookie settings, token expiration, and consider encryption for sensitive data.

## Implementation Checklist

Before deploying to production, verify:

- [ ] Session middleware configured and placed before authentication in pipeline
- [ ] Cookie security settings configured (HttpOnly, Secure, SameSite)
- [ ] Token expiration checking implemented
- [ ] Token refresh logic in place (if using refresh tokens)
- [ ] JavaScript interop only called in OnAfterRenderAsync
- [ ] Response.HasStarted checked before session writes
- [ ] NotifyAuthenticationStateChanged called after auth state changes
- [ ] All render modes tested (SSR, Server, WASM, Auto)
- [ ] Error handling and logging implemented
- [ ] Browser refresh and multi-tab scenarios tested
- [ ] Security audit completed (for sensitive applications)
- [ ] Performance testing under load

## Next Steps

This authentication pattern has been battle-tested in government production environments and is ready for your enterprise application. Here's how to get started:

### 1. Download the Complete Implementation

I've packaged the entire solution with:
- Complete source code
- Unit and integration tests
- Configuration examples
- Security hardening guide
- Deployment checklist

**[View on GitHub](https://github.com/ljblab/blazor8-hybrid-auth)** ⭐ Star the repo to stay updated

### 2. Review the Security Checklist

Ensure your implementation meets enterprise security requirements:
- Token encryption guidelines
- Cookie security settings
- CSRF protection verification
- Compliance requirements (FedRAMP, HIPAA, etc.)

**[Download Security Audit Template](https://ljblab.dev/resources/blazor-security-checklist)**

### 3. Explore Related Guides

- **Multi-Tenant Authentication**: Extending this pattern for multi-tenant scenarios
- **Azure AD B2C Integration**: Connecting to Microsoft identity platform
- **Token Refresh Strategies**: Implementing seamless token renewal
- **Performance Optimization**: Caching strategies and best practices

### 4. Join the Community

Get weekly Blazor insights, solutions, and updates:
- **Newsletter**: Production-tested patterns and real-world solutions
- **GitHub Discussions**: Ask questions and share experiences
- **Blog Updates**: New articles on Blazor, authentication, and enterprise development

**[Subscribe to the Newsletter](https://ljblab.dev/newsletter)**

## Need Enterprise Support?

Implementing authentication for a government or enterprise Blazor application involves navigating complex security requirements, compliance standards, and architectural decisions.

**I've helped organizations:**
- Design authentication architecture for multi-tenant SaaS applications
- Pass FedRAMP and FISMA compliance audits
- Migrate legacy authentication to modern identity platforms
- Optimize authentication performance for high-traffic applications
- Implement zero-trust security models

**What you get:**
- Architecture review and recommendations
- Code review and security audit
- Implementation guidance and best practices
- Ongoing support during deployment
- Compliance documentation assistance

**[Schedule a consultation](https://ljblab.dev/contact)** or reach out at **lincoln@ljblab.dev**

---

*Lincoln J Bicalho is a Senior Software Engineer specializing in Blazor and AI integration for government systems. With Azure Developer Associate and DevOps Engineer Expert certifications, he's currently modernizing federal government applications and building Text-to-SQL AI systems using multi-agent orchestration.*
