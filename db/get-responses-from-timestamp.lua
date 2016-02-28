
-- ./redis-cli eval "$(cat get-responses-from-timestamp.lua)" 0 1450911000000

local responses = redis.pcall('lrange', 'system/responses', 0, -1)
local result = {}

for index, responseString in pairs(responses) do
  local response = cjson.decode(responseString)
  if tonumber(response['timestamp']) >= tonumber(ARGV[1]) then
    result[#result + 1] = responseString
  end
end

return result