const PASSWORD_PATTERN =
  /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^*()_+~]).{8,20}$/;
const REPEATED_CHARACTER_PATTERN = /(.)\1\1/;

export function validatePassword(email: string, password: string): string | null {
  if (password.length === 0) {
    return "비밀번호를 입력해 주세요.";
  }

  if (password.length < 8 || password.length > 20) {
    return "비밀번호는 8~20자로 입력해 주세요.";
  }

  if (!PASSWORD_PATTERN.test(password)) {
    return "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.";
  }

  if (REPEATED_CHARACTER_PATTERN.test(password)) {
    return "같은 문자를 3번 연속 사용할 수 없습니다.";
  }

  const username = email.split("@")[0]?.trim().toLowerCase();
  if (username && password.toLowerCase().includes(username)) {
    return "비밀번호에 이메일 아이디를 포함할 수 없습니다.";
  }

  return null;
}
