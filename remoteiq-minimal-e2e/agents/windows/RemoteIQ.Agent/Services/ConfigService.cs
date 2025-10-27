using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RemoteIQ.Agent.Models;

namespace RemoteIQ.Agent.Services;

public sealed class ConfigService
{
    private readonly IConfiguration _cfg;
    private readonly ILogger<ConfigService> _log;

    private readonly string _configPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "RemoteIQ", "agent.config.json");

    public AgentConfig Current { get; private set; }

    public ConfigService(IConfiguration cfg, ILogger<ConfigService> log)
    {
        _cfg = cfg;
        _log = log;

        Directory.CreateDirectory(Path.GetDirectoryName(_configPath)!);

        var defaults = new AgentConfig();
        _cfg.GetSection("RemoteIQ").Bind(defaults);

        Current = LoadOrInit(defaults);
    }

    private AgentConfig LoadOrInit(AgentConfig defaults)
    {
        if (!File.Exists(_configPath))
        {
            Save(defaults);
            return defaults;
        }

        var json = File.ReadAllText(_configPath, Encoding.UTF8);
        var cfg = System.Text.Json.JsonSerializer.Deserialize<AgentConfig>(json) ?? defaults;

        if (!string.IsNullOrEmpty(cfg.AgentKey) && cfg.AgentKey.StartsWith("DPAPI:"))
        {
            try
            {
                var b64 = cfg.AgentKey.Substring("DPAPI:".Length);
                var enc = Convert.FromBase64String(b64);
                var clear = ProtectedData.Unprotect(enc, null, DataProtectionScope.LocalMachine);
                cfg.AgentKey = Encoding.UTF8.GetString(clear);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Failed to decrypt AgentKey; will require re-enrollment.");
                cfg.AgentKey = "";
            }
        }

        return cfg;
    }

    public void Save(AgentConfig cfg)
    {
        var toStore = new AgentConfig
        {
            ApiBaseUrl = cfg.ApiBaseUrl,
            AgentId = cfg.AgentId,
            AgentGroup = cfg.AgentGroup,
            PollIntervals = cfg.PollIntervals,
            Security = cfg.Security,
            AgentKey = ""
        };

        if (!string.IsNullOrEmpty(cfg.AgentKey))
        {
            var clear = Encoding.UTF8.GetBytes(cfg.AgentKey);
            var enc = ProtectedData.Protect(clear, null, DataProtectionScope.LocalMachine);
            toStore.AgentKey = "DPAPI:" + Convert.ToBase64String(enc);
        }

        var json = System.Text.Json.JsonSerializer.Serialize(toStore, new System.Text.Json.JsonSerializerOptions
        {
            WriteIndented = true
        });

        File.WriteAllText(_configPath, json, Encoding.UTF8);
        Current = cfg;
    }
}
