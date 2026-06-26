# 1단계: 빌드 스테이지 (내 로컬 LTS 환경과 동기화)
FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=/
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# 의존성 설치 (캐싱 활용)
COPY package*.json ./
RUN npm ci

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# 2단계: 실행 스테이지 (프로덕션 환경 최적화)
FROM node:22-alpine AS runner
WORKDIR /app

# 보안과 운영을 위해 프로덕션 환경 선언
ENV NODE_ENV=production

# 💡 Next.js 실행에 필요한 핵심 파일만 쏙 골라서 복사 (용량 최소화)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# 본체 Nginx가 쳐다볼 3000번 포트 개방
EXPOSE 3000

# 서버 시작 규칙
CMD ["npm", "start"]
