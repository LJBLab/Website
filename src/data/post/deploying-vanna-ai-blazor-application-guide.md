---
publishDate: 2024-12-17T00:00:00Z
title: 'Deploying Your Vanna AI + Blazor Application: A Step-by-Step Guide'
excerpt: 'Part 3 of our Vanna AI + Blazor series: Deploy your application to Azure with proper security, monitoring, and performance optimization. Includes real deployment configurations and troubleshooting tips.'
image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80'
tags:
  - blazor
  - vanna-ai
  - azure
  - deployment
  - devops
metadata:
  canonical: https://ljblab.dev/deploying-vanna-ai-blazor-application-guide
author: Lincoln J Bicalho
---

After building the interface (Part 1) and implementing security (Part 2), it's time to deploy your Vanna AI + Blazor application to production. In this final part of our series, I'll walk you through deploying to Azure with proper configuration, security, and monitoring.

Having deployed similar AI-powered applications in government environments, I've learned that deployment is where theory meets reality. A query that works perfectly locally might timeout in production, or API keys that work in development might fail due to network policies. This guide covers the practical steps to get your application running reliably in Azure.

## Understanding Deployment Requirements

Before diving into Azure, let's understand what we're deploying:

1. **Blazor Server Application** - Needs SignalR support and persistent connections
2. **Vanna AI Integration** - Requires external API access and proper key management
3. **Database Connections** - Both for your application data and Vanna's SQL queries
4. **Real-time Features** - SignalR for live query results and progress updates

The key challenge is ensuring all these components work together seamlessly in a cloud environment with proper security and performance.

## Step 1: Preparing Your Application

First, let's configure the application for production deployment.

### Update appsettings.json Structure

Create an `appsettings.Production.json` file:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "",
    "DataWarehouse": ""
  },
  "VannaAI": {
    "ApiKey": "",
    "BaseUrl": "https://api.vanna.ai/rpc",
    "Model": "your-model-name",
    "TimeoutSeconds": 60
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "VannaAI": "Information"
    }
  },
  "AllowedHosts": "*"
}
```

### Configure Health Checks

Add health checks for monitoring your dependencies:

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")!)
    .AddSqlServer(builder.Configuration.GetConnectionString("DataWarehouse")!)
    .AddUrlGroup(new Uri("https://api.vanna.ai/health"), "vanna-api")
    .AddCheck<VannaHealthCheck>("vanna-service");

// Custom health check
public class VannaHealthCheck : IHealthCheck
{
    private readonly VannaService _vannaService;

    public VannaHealthCheck(VannaService vannaService)
    {
        _vannaService = vannaService;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Simple test query to verify Vanna is responsive
            await _vannaService.ValidateConnectionAsync();
            return HealthCheckResult.Healthy("Vanna AI service is responsive");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy($"Vanna AI service failed: {ex.Message}");
        }
    }
}
```

### Add Production Logging

Configure structured logging for Azure App Service:

```csharp
// Program.cs
if (builder.Environment.IsProduction())
{
    builder.Logging.AddAzureWebAppDiagnostics();
    builder.Services.Configure<AzureFileLoggerOptions>(options =>
    {
        options.FileName = "vanna-blazor-";
        options.FileSizeLimit = 50 * 1024 * 1024; // 50MB
        options.RetainedFileCountLimit = 5;
    });
}
```

## Step 2: Setting Up Azure Resources

Now let's create the Azure infrastructure. I'll show both Azure CLI and Portal approaches.

### Create Resource Group and App Service Plan

```bash
# Login to Azure
az login

# Create resource group
az group create --name rg-vanna-blazor --location eastus

# Create App Service plan (Standard tier for SignalR support)
az appservice plan create \
  --name plan-vanna-blazor \
  --resource-group rg-vanna-blazor \
  --sku S1 \
  --location eastus
```

### Create Azure SQL Database

```bash
# Create SQL Server
az sql server create \
  --name sql-vanna-blazor-prod \
  --resource-group rg-vanna-blazor \
  --location eastus \
  --admin-user sqladmin \
  --admin-password 'YourSecurePassword123!'

# Configure firewall for Azure services
az sql server firewall-rule create \
  --resource-group rg-vanna-blazor \
  --server sql-vanna-blazor-prod \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create database
az sql db create \
  --resource-group rg-vanna-blazor \
  --server sql-vanna-blazor-prod \
  --name VannaBlazorDB \
  --service-objective S0
```

### Create App Service

```bash
# Create the web app
az webapp create \
  --resource-group rg-vanna-blazor \
  --plan plan-vanna-blazor \
  --name webapp-vanna-blazor-prod \
  --runtime "DOTNET|8.0"

# Enable Always On (important for SignalR)
az webapp config set \
  --resource-group rg-vanna-blazor \
  --name webapp-vanna-blazor-prod \
  --always-on true

# Configure WebSockets (required for SignalR)
az webapp config set \
  --resource-group rg-vanna-blazor \
  --name webapp-vanna-blazor-prod \
  --web-sockets-enabled true
```

## Step 3: Configuring Application Settings

Set up configuration using Azure Key Vault for sensitive data:

### Create Key Vault

```bash
# Create Key Vault
az keyvault create \
  --name kv-vanna-blazor-prod \
  --resource-group rg-vanna-blazor \
  --location eastus

# Add secrets
az keyvault secret set \
  --vault-name kv-vanna-blazor-prod \
  --name "VannaAI--ApiKey" \
  --value "your-vanna-api-key"

az keyvault secret set \
  --vault-name kv-vanna-blazor-prod \
  --name "ConnectionStrings--DefaultConnection" \
  --value "Server=tcp:sql-vanna-blazor-prod.database.windows.net,1433;Database=VannaBlazorDB;User ID=sqladmin;Password=YourSecurePassword123!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
```

### Configure App Service Identity

```bash
# Enable managed identity
az webapp identity assign \
  --resource-group rg-vanna-blazor \
  --name webapp-vanna-blazor-prod

# Get the principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --resource-group rg-vanna-blazor \
  --name webapp-vanna-blazor-prod \
  --query principalId --output tsv)

# Grant access to Key Vault
az keyvault set-policy \
  --name kv-vanna-blazor-prod \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

### Update Application Configuration

Modify your `Program.cs` to use Key Vault:

```csharp
// Program.cs
if (builder.Environment.IsProduction())
{
    var keyVaultUrl = builder.Configuration["KeyVaultUrl"];
    if (!string.IsNullOrEmpty(keyVaultUrl))
    {
        builder.Configuration.AddAzureKeyVault(
            new Uri(keyVaultUrl),
            new DefaultAzureCredential());
    }
}
```

Set the Key Vault URL in App Service settings:

```bash
az webapp config appsettings set \
  --resource-group rg-vanna-blazor \
  --name webapp-vanna-blazor-prod \
  --settings KeyVaultUrl="https://kv-vanna-blazor-prod.vault.azure.net/"
```

## Step 4: Deploying the Application

Now let's deploy using Visual Studio publish profiles or Azure CLI.

### Create Publish Profile

In Visual Studio, right-click your project and select "Publish." Choose Azure App Service and configure:

```xml
<!-- Properties/PublishProfiles/Azure.pubxml -->
<?xml version="1.0" encoding="utf-8"?>
<Project ToolsVersion="4.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <PropertyGroup>
    <WebPublishMethod>MSDeploy</WebPublishMethod>
    <ResourceId>/subscriptions/{subscription-id}/resourceGroups/rg-vanna-blazor/providers/Microsoft.Web/sites/webapp-vanna-blazor-prod</ResourceId>
    <PublishProvider>AzureWebSite</PublishProvider>
    <LastUsedBuildConfiguration>Release</LastUsedBuildConfiguration>
    <LastUsedPlatform>Any CPU</LastUsedPlatform>
    <SiteUrlToLaunchAfterPublish>https://webapp-vanna-blazor-prod.azurewebsites.net</SiteUrlToLaunchAfterPublish>
    <LaunchSiteAfterPublish>True</LaunchSiteAfterPublish>
    <ProjectGuid>{your-project-guid}</ProjectGuid>
    <PublishUrl>https://webapp-vanna-blazor-prod.scm.azurewebsites.net/</PublishUrl>
    <UserName>$webapp-vanna-blazor-prod</UserName>
  </PropertyGroup>
</Project>
```

### Deploy Using Azure CLI

Alternatively, deploy using the command line:

```bash
# Build the application
dotnet publish -c Release -o ./publish

# Create deployment package
cd publish
zip -r ../app.zip .
cd ..

# Deploy to Azure
az webapp deploy \
  --resource-group rg-vanna-blazor \
  --name webapp-vanna-blazor-prod \
  --src-path app.zip \
  --type zip
```

## Step 5: Database Migration

Run Entity Framework migrations on the deployed database:

```bash
# Update connection string for production
export ConnectionStrings__DefaultConnection="Server=tcp:sql-vanna-blazor-prod.database.windows.net,1433;Database=VannaBlazorDB;User ID=sqladmin;Password=YourSecurePassword123!;Encrypt=True;"

# Run migrations
dotnet ef database update --connection "$ConnectionStrings__DefaultConnection"
```

Or configure automatic migrations in your application startup:

```csharp
// Program.cs
if (app.Environment.IsProduction())
{
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        context.Database.Migrate();
    }
}
```

## Step 6: Testing the Deployed Application

Create a comprehensive testing checklist:

### Automated Health Check Tests

```csharp
public class DeploymentTests
{
    private readonly HttpClient _client;

    public DeploymentTests()
    {
        _client = new HttpClient
        {
            BaseAddress = new Uri("https://webapp-vanna-blazor-prod.azurewebsites.net")
        };
    }

    [Fact]
    public async Task HealthCheck_Should_Return_Healthy()
    {
        var response = await _client.GetAsync("/health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Healthy");
    }

    [Fact]
    public async Task VannaAI_Integration_Should_Work()
    {
        var response = await _client.GetAsync("/api/vanna/test");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

### Manual Testing Checklist

1. **Application Loads**: Navigate to your deployed URL
2. **Authentication Works**: Test login/logout functionality
3. **Database Connection**: Verify data loads correctly
4. **Vanna AI Integration**: Submit a test query and verify results
5. **SignalR Connection**: Confirm real-time updates work
6. **Performance**: Check page load times are acceptable
7. **Error Handling**: Test invalid queries return proper error messages

## Step 7: Monitoring and Troubleshooting

Set up Application Insights for monitoring:

```bash
# Create Application Insights
az monitor app-insights component create \
  --app ai-vanna-blazor \
  --location eastus \
  --resource-group rg-vanna-blazor \
  --application-type web

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app ai-vanna-blazor \
  --resource-group rg-vanna-blazor \
  --query instrumentationKey --output tsv)

# Configure App Service
az webapp config appsettings set \
  --resource-group rg-vanna-blazor \
  --name webapp-vanna-blazor-prod \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY="$INSTRUMENTATION_KEY"
```

### Add Application Insights to Your Code

```csharp
// Program.cs
builder.Services.AddApplicationInsightsTelemetry();

// Custom telemetry for Vanna queries
public class VannaService
{
    private readonly TelemetryClient _telemetryClient;

    public async Task<QueryResult> ExecuteQueryAsync(string naturalLanguage)
    {
        using var operation = _telemetryClient.StartOperation<DependencyTelemetry>("VannaAI Query");
        operation.Telemetry.Data = naturalLanguage;

        try
        {
            var result = await _vannaClient.QueryAsync(naturalLanguage);
            operation.Telemetry.Success = true;
            _telemetryClient.TrackMetric("VannaAI.QueryLatency", operation.Telemetry.Duration.TotalMilliseconds);
            return result;
        }
        catch (Exception ex)
        {
            operation.Telemetry.Success = false;
            _telemetryClient.TrackException(ex);
            throw;
        }
    }
}
```

### Common Issues and Solutions

**SignalR Connection Failures**
- Ensure WebSockets are enabled in App Service
- Check if Always On is configured
- Verify firewall rules allow WebSocket connections

**Vanna AI Timeouts**
- Increase timeout values for complex queries
- Implement retry logic with exponential backoff
- Cache frequent queries to reduce API calls

**Database Connection Issues**
- Verify connection strings are correct
- Check Azure SQL firewall rules
- Ensure managed identity has proper permissions

**Performance Issues**
- Enable Application Insights performance counters
- Monitor SQL query performance
- Consider implementing query result caching

## Production Considerations

Based on my experience with government systems, here are key production considerations:

### Security
- Always use HTTPS in production
- Implement proper authentication and authorization
- Store sensitive configuration in Key Vault
- Regular security updates and dependency scanning

### Performance
- Monitor query response times
- Implement caching for frequently asked questions
- Consider query complexity limits to prevent resource exhaustion
- Set up auto-scaling rules based on CPU and memory usage

### Monitoring
- Set up alerts for application failures
- Monitor Vanna AI API usage and costs
- Track query accuracy and user satisfaction
- Log all database queries for audit purposes

### Disaster Recovery
- Regular database backups
- Document deployment procedures
- Test disaster recovery scenarios
- Maintain staging environment for testing

## Next Steps

With your Vanna AI + Blazor application now deployed, consider these enhancements:

1. **Enhanced Monitoring**: Add custom dashboards and alerts
2. **Performance Optimization**: Implement caching and query optimization
3. **User Analytics**: Track which types of queries are most common
4. **AI Accuracy Monitoring**: Log and review AI-generated SQL for accuracy
5. **Feature Flags**: Use Azure App Configuration for feature toggles

The deployment process might seem complex, but it ensures your application is secure, scalable, and maintainable. Each step addresses real-world challenges I've encountered when deploying AI-powered applications in production environments.

Your users can now access natural language querying capabilities through a robust, production-ready interface. Monitor the application closely in the first few weeks to identify any performance bottlenecks or user experience issues that need addressing.

Remember: successful deployment is just the beginning. The real value comes from iterating based on user feedback and continuously improving the AI's accuracy and the application's performance.