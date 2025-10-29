// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/Program.cs
using System;
using System.IO;
using System.Net.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Configuration.Binder; // for .Bind(...)
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.EventLog; // explicit (Windows Event Log)
using RemoteIQ.Agent;
using RemoteIQ.Agent.Options;
using RemoteIQ.Agent.Services;
using RemoteIQ.Agent.Services.Http;
using RemoteIQ.Agent.Services.Security;
using RemoteIQ.Agent.Services.Update;

Directory.SetCurrentDirectory(AppContext.BaseDirectory);

var builder = Host.CreateApplicationBuilder(args);

// ----- Configuration (appsettings.json + env) -----
builder.Configuration
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

// ----- Logging -----
builder.Logging.ClearProviders();
// Console for interactive runs
builder.Logging.AddSimpleConsole(o =>
{
    o.SingleLine = true;
    o.TimestampFormat = "yyyy-MM-dd HH:mm:ss ";
});

// EventLog only when running as a Windows Service (avoids admin during dev)
if (!Environment.UserInteractive)
{
    builder.Logging.AddEventLog(o =>
    {
        o.SourceName = "RemoteIQ Agent";
        o.LogName = "Application";
    });
}

// (optional) Graceful shutdown window for background services
builder.Services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromSeconds(15));

// ----- Windows Service support -----
builder.Services.AddWindowsService(options => options.ServiceName = "RemoteIQ Agent");

// ----- Options binding WITHOUT Options.ConfigurationExtensions -----
// Bind into a concrete POCO and register it as a singleton.
// (No IOptions<T> required anywhere.)
var agentOptions = new AgentOptions();
builder.Configuration.GetSection("Agent").Bind(agentOptions);
builder.Services.AddSingleton(agentOptions);

// ----- Resolve API base (env > config > default) -----
var apiBase =
    builder.Configuration["NEXT_PUBLIC_API_BASE"] ??
    builder.Configuration["Agent:ApiBase"] ??
    agentOptions.ApiBase ??
    "http://localhost:3001";

if (!Uri.TryCreate(apiBase, UriKind.Absolute, out var apiUri))
{
    apiUri = new Uri("http://localhost:3001");
}
Console.WriteLine($"[Startup] Agent API base: {apiUri}");

// ----- Typed HttpClient for ApiClient -----
builder.Services.AddHttpClient<ApiClient>(client =>
{
    client.BaseAddress = apiUri;
    client.Timeout = TimeSpan.FromSeconds(30);
})
.ConfigurePrimaryHttpMessageHandler(() =>
{
    var handler = new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback = (req, cert, chain, errors) =>
        {
            var uri = req?.RequestUri;
            if (uri is null) return false;

            // Dev convenience ONLY: allow http://localhost/*
            if (uri.Scheme == Uri.UriSchemeHttp &&
                (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                 uri.Host.Equals("127.0.0.1")))
            {
                return true;
            }

            // For HTTPS, require a clean chain
            return errors == System.Net.Security.SslPolicyErrors.None &&
                   uri.Scheme == Uri.UriSchemeHttps;
        }
    };
    return handler;
});

// ----- Core services -----
builder.Services.AddSingleton<TokenStore>();
builder.Services.AddSingleton<Updater>();
builder.Services.AddSingleton<EnrollmentClient>();
builder.Services.AddSingleton<WebSocketClient>();

// Background service that drives the agent loops
builder.Services.AddHostedService<AgentService>();

await builder.Build().RunAsync();
