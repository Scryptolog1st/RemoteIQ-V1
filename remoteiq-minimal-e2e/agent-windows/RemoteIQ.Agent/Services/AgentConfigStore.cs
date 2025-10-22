using System.Text.Json;
using RemoteIQ.Agent.Models;

namespace RemoteIQ.Agent.Services;

public class AgentConfigStore
{
    private readonly string _path;
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    public AgentConfigStore()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "RemoteIQ"
        );
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "agent.json");
    }

    public async Task<AgentConfig?> LoadAsync()
    {
        if (!File.Exists(_path)) return null;
        var json = await File.ReadAllTextAsync(_path);
        return JsonSerializer.Deserialize<AgentConfig>(json, _json);
    }

    public async Task SaveAsync(AgentConfig cfg)
    {
        var json = JsonSerializer.Serialize(cfg, _json);
        await File.WriteAllTextAsync(_path, json);
    }

    public void Delete()
    {
        if (File.Exists(_path)) File.Delete(_path);
    }
}
