# PB_JaebiBbobkki

모바일 우선 실시간 제비뽑기 웹앱입니다.

- 기본 제비: **당첨 2개 + 꽝 98개**
- 하나의 링크를 여러 휴대폰에서 공유
- 서버에서 덱 순서를 확정하고 한 장씩 소진
- 동시에 눌러도 하나의 추첨만 진행되도록 추첨 잠금 적용
- 추첨 애니메이션: 상자 줌 → 흔들림 → 제비 상승 → 결과 공개 → 확인
- 우측 상단 설정에서 당첨/꽝 제비 추가
- 제비 추가 시 **이미 뽑힌 결과는 유지**하고 남은 덱 + 새 제비만 다시 섞음

## 1. Supabase 준비

1. Supabase에서 새 프로젝트를 생성합니다.
2. **SQL Editor**를 엽니다.
3. 이 저장소의 `supabase/schema.sql` 전체를 실행합니다.
4. Project Settings → API에서 아래 두 값을 확인합니다.
   - Project URL
   - `anon` / publishable key

`schema.sql`을 처음 실행하면 `main` 방에 당첨 2개, 꽝 98개가 무작위 순서로 생성됩니다.

> 덱 실제 순서는 `lottery_decks`에 저장되며 anon 사용자에게 SELECT 권한이 없습니다. 브라우저에는 아직 뽑히지 않은 결과가 전달되지 않습니다.

## 2. Vercel 배포

GitHub 저장소를 Vercel에 Import합니다.

### Environment Variables

Vercel 프로젝트 Settings → Environment Variables에 추가합니다.

| Name | Value |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/publishable key |

Framework Preset은 **Other**로 사용하면 됩니다. 별도 Build Command는 필요하지 않습니다.

배포가 끝나면 생성된 Vercel URL 하나만 공유하면 됩니다.

## 3. 파일 구조

```text
.
├── api/
│   └── config.js             # Vercel 환경변수를 브라우저에 전달
├── public/
│   ├── app.mjs               # UI, 추첨, Realtime 동기화
│   ├── core.mjs              # 확률/표시 순수 함수
│   └── styles.css            # 모바일 UI와 애니메이션
├── supabase/
│   └── schema.sql            # DB, 보안 정책, RPC, 초기 100장
├── tests/
├── index.html
└── vercel.json
```

## 4. 동시 추첨 처리

`draw_ticket` RPC가 DB row lock을 잡고 결과 한 장을 소진합니다. 추첨이 시작되면 15초짜리 서버 잠금이 생기며 다른 휴대폰의 뽑기 요청은 `DRAW_IN_PROGRESS`로 거절됩니다.

정상 흐름에서는 결과 확인 버튼을 누를 때 `confirm_draw`가 잠금을 해제합니다. 브라우저가 갑자기 종료되어도 잠금은 15초 후 만료되어 다음 추첨이 가능합니다.

## 5. 테스트

Node.js 20+에서 추가 패키지 없이 실행됩니다.

```bash
node --test tests/*.test.mjs
```
Deployment trigger
