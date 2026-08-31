export const INITIALIZE_SCRIPT = `
local stateKey = KEYS[1]
local deckKey = KEYS[2]
local drawingKey = KEYS[3]

if redis.call('HEXISTS', stateKey, 'initialized') == 0 then
  local initialWins = tonumber(ARGV[1]) or 2
  local initialBlanks = tonumber(ARGV[2]) or 98
  local seed = tonumber(ARGV[3]) or 1
  local tickets = {}

  for i = 1, initialWins do
    tickets[#tickets + 1] = 'WIN'
  end
  for i = 1, initialBlanks do
    tickets[#tickets + 1] = 'BLANK'
  end

  math.randomseed(seed)
  for i = #tickets, 2, -1 do
    local j = math.random(i)
    tickets[i], tickets[j] = tickets[j], tickets[i]
  end

  redis.call('DEL', deckKey)
  for i = 1, #tickets do
    redis.call('RPUSH', deckKey, tickets[i])
  end

  redis.call('HSET', stateKey,
    'initialized', '1',
    'remaining_wins', tostring(initialWins),
    'version', '1'
  )
end

local remaining = redis.call('LLEN', deckKey)
local remainingWins = tonumber(redis.call('HGET', stateKey, 'remaining_wins') or '0')
local drawing = redis.call('EXISTS', drawingKey)
local version = tonumber(redis.call('HGET', stateKey, 'version') or '0')
return {remaining, remainingWins, drawing, version}
`;

export const DRAW_SCRIPT = `
local stateKey = KEYS[1]
local deckKey = KEYS[2]
local drawingKey = KEYS[3]
local historyKey = KEYS[4]

if redis.call('HEXISTS', stateKey, 'initialized') == 0 then
  return {'ERR', 'NOT_INITIALIZED'}
end
if redis.call('EXISTS', drawingKey) == 1 then
  return {'ERR', 'DRAW_IN_PROGRESS'}
end

local ticket = redis.call('LPOP', deckKey)
if not ticket then
  return {'ERR', 'EMPTY_DECK'}
end

local remainingWins = tonumber(redis.call('HGET', stateKey, 'remaining_wins') or '0')
if ticket == 'WIN' then
  remainingWins = math.max(0, remainingWins - 1)
  redis.call('HSET', stateKey, 'remaining_wins', tostring(remainingWins))
end

local version = redis.call('HINCRBY', stateKey, 'version', 1)
local remaining = redis.call('LLEN', deckKey)
local drawRecord = cjson.encode({ token = ARGV[1], result = ticket, created_at = ARGV[3] })
redis.call('SET', drawingKey, drawRecord, 'EX', tonumber(ARGV[2]))
redis.call('LPUSH', historyKey, drawRecord)
redis.call('LTRIM', historyKey, 0, 499)

return {'OK', ticket, remaining, remainingWins, version}
`;

export const CONFIRM_SCRIPT = `
local stateKey = KEYS[1]
local deckKey = KEYS[2]
local drawingKey = KEYS[3]

if redis.call('HEXISTS', stateKey, 'initialized') == 0 then
  return {'ERR', 'NOT_INITIALIZED'}
end

local drawingRaw = redis.call('GET', drawingKey)
if drawingRaw then
  local drawing = cjson.decode(drawingRaw)
  if drawing.token ~= ARGV[1] then
    return {'ERR', 'DRAW_TOKEN_MISMATCH'}
  end
  redis.call('DEL', drawingKey)
  redis.call('HINCRBY', stateKey, 'version', 1)
end

local remaining = redis.call('LLEN', deckKey)
local remainingWins = tonumber(redis.call('HGET', stateKey, 'remaining_wins') or '0')
local version = tonumber(redis.call('HGET', stateKey, 'version') or '0')
return {'OK', remaining, remainingWins, 0, version}
`;

export const ADD_SCRIPT = `
local stateKey = KEYS[1]
local deckKey = KEYS[2]
local drawingKey = KEYS[3]

if redis.call('HEXISTS', stateKey, 'initialized') == 0 then
  return {'ERR', 'NOT_INITIALIZED'}
end
if redis.call('EXISTS', drawingKey) == 1 then
  return {'ERR', 'DRAW_IN_PROGRESS'}
end

local addWins = tonumber(ARGV[1]) or 0
local addBlanks = tonumber(ARGV[2]) or 0
local seed = tonumber(ARGV[3]) or 1
local tickets = redis.call('LRANGE', deckKey, 0, -1)

for i = 1, addWins do
  tickets[#tickets + 1] = 'WIN'
end
for i = 1, addBlanks do
  tickets[#tickets + 1] = 'BLANK'
end

math.randomseed(seed)
for i = #tickets, 2, -1 do
  local j = math.random(i)
  tickets[i], tickets[j] = tickets[j], tickets[i]
end

redis.call('DEL', deckKey)
for i = 1, #tickets do
  redis.call('RPUSH', deckKey, tickets[i])
end

local remainingWins = tonumber(redis.call('HGET', stateKey, 'remaining_wins') or '0') + addWins
redis.call('HSET', stateKey, 'remaining_wins', tostring(remainingWins))
local version = redis.call('HINCRBY', stateKey, 'version', 1)
local remaining = redis.call('LLEN', deckKey)
return {'OK', remaining, remainingWins, 0, version}
`;
