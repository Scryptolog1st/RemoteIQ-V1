using System.Text.Json;

namespace RemoteIQ.Agent.Util;

public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public static string Stringify<T>(T obj) => JsonSerializer.Serialize(obj, Options);
    public static T Parse<T>(string s) => JsonSerializer.Deserialize<T>(s, Options)!;
}