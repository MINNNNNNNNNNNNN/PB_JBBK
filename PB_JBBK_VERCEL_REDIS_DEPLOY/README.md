# PB 제비뽑기 — Vercel + Redis 버전

여러 휴대폰이 하나의 제비통을 공유하는 모바일 제비뽑기입니다.

- 시작 제비: 당첨 2 + 꽝 98 = 100개
- 여러 기기에서 같은 남은 수량 공유
- 동시 추첨은 Redis Lua 스크립트로 원자 처리
- 확인 전에는 다른 기기 추첨 잠금
- 브라우저가 닫혀도 90초 후 잠금 자동 해제
- 설정에서는 당첨/꽝 **추가만** 가능
- 추가 시 이미 뽑은 기록은 유지하고 남은 제비 + 새 제비만 다시 섞음
- Supabase 불필요

## GitHub 루트 구조

```text
index.html
package.json
vercel.json
api/
public/
server/
tests/
docs/
```

ZIP 자체를 GitHub에 올리는 것이 아니라, ZIP을 푼 뒤 위 내용물이 저장소 최상단에 보여야 합니다.

## Vercel 배포

1. GitHub 저장소를 Vercel Project로 Import합니다.
2. Framework Preset은 `Other`로 둡니다.
3. Root Directory는 `./` 입니다.
4. 별도 Build Command / Output Directory는 필요 없습니다.
5. 첫 배포 후 Vercel 프로젝트에서 Redis 저장소를 연결합니다.

## Redis 연결 — Vercel Marketplace

Vercel Project에서 Storage/Marketplace로 이동해 **Upstash Redis** 계열 Redis 리소스를 생성하고 현재 프로젝트에 연결합니다. 별도 prefix를 지정하지 않는 것을 권장합니다.

연결 후 `Settings → Environment Variables`에서 아래 둘 중 한 쌍이 자동으로 생겼는지 확인합니다.

현재 Upstash 이름:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

또는 기존 Vercel KV 호환 이름:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

이 프로젝트는 두 이름을 모두 지원합니다. 값을 브라우저 코드에 복사하지 마세요. 서버 함수에서만 사용합니다.

Redis 연결을 **첫 배포 뒤에 추가했다면 반드시 Redeploy** 합니다.

## 정상 여부 확인

배포 후 브라우저에서 먼저 아래 주소를 엽니다.

```text
https://<프로젝트주소>.vercel.app/api/state
```

최초 정상 응답 예시:

```json
{
  "remaining_count": 100,
  "remaining_wins": 2,
  "is_drawing": false,
  "version": 1
}
```

`REDIS_CONFIG_MISSING`가 나오면 Redis 리소스가 프로젝트에 연결되지 않았거나 환경변수가 새 배포에 적용되지 않은 상태입니다.

## 로컬 테스트

Node.js 22 이상에서:

```bash
npm test
```

런타임 의존 패키지는 없습니다.
