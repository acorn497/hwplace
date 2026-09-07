/**
 * 첫 관리자를 세우기 위한 스크립트.
 *
 * 관리 API는 전부 ADMIN 권한을 요구하므로, DB에 관리자가 하나도 없으면
 * 아무도 관리자를 임명할 수 없다(닭과 달걀). 그 최초 1명만 여기서 만든다.
 * 그 뒤부터는 관리자 패널에서 임명하면 된다.
 *
 * 사용법:
 *   npm run admin:grant -- admin@example.com
 *   npm run admin:grant -- admin@example.com --revoke
 */
import { PrismaClient, Role } from '@prisma/client';

async function main() {
  const [email, ...flags] = process.argv.slice(2);

  if (!email) {
    console.error('사용법: npm run admin:grant -- <email> [--revoke]');
    process.exit(1);
  }

  const revoke = flags.includes('--revoke');
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { USER_EMAIL: email },
      select: { USER_INDEX: true, USER_DISPLAY: true, USER_ROLE: true },
    });

    if (!user) {
      console.error(`'${email}' 계정을 찾을 수 없습니다. 먼저 회원가입을 해주세요.`);
      process.exit(1);
    }

    const role = revoke ? Role.USER : Role.ADMIN;

    if (user.USER_ROLE === role) {
      console.log(`'${email}' 은(는) 이미 ${role} 입니다.`);
      return;
    }

    await prisma.user.update({
      where: { USER_INDEX: user.USER_INDEX },
      data: { USER_ROLE: role },
    });

    console.log(`'${email}' (${user.USER_DISPLAY}) 의 권한을 ${user.USER_ROLE} → ${role} 로 변경했습니다.`);
    console.log('이미 로그인 중이라면 다시 로그인해야 관리자 패널이 보입니다.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
