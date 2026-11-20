import type { MediaConversationTurn } from './localMediaAnalysis';

function normalize(value: string): string {
  return value.replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function isGreeting(value: string): boolean {
  return /^(?:hi(?:hi){0,5}|hi hi|hello|helo|hey|xin chao|chao|alo)(?: songbot)?$/.test(normalize(value));
}

export function mediaSocialReply(question: string, history: MediaConversationTurn[]): string | null {
  const words = normalize(question);
  if (/^(?:ok|oke|duoc|da|vang|uh|um)$/.test(words)) {
    return 'Ừ, mình nghe đây. Bạn cứ hỏi mã sản phẩm cần kiểm tra hoặc gửi ảnh/PDF để mình xử lý nhé.';
  }
  if (/^(?:cam on|thanks|thank you|thank)(?: songbot)?$/.test(words)) {
    return 'Không có gì. Nếu còn ảnh/PDF hoặc mã sản phẩm cần xử lý, bạn cứ gửi mình nhé.';
  }
  if (/^(?:ban khoe khong|songbot khoe khong)$/.test(words)) {
    return 'Mình sẵn sàng làm việc 😄 Bạn muốn tra một mã sản phẩm hay gửi file để mình đối chiếu?';
  }
  if (!isGreeting(question)) return null;

  const previousUsers = history.filter((turn) => turn.role === 'user').map((turn) => turn.text);
  const previousCode = [...previousUsers].reverse().map((text) => text.match(/\b(?=[A-Za-z0-9.-]*\d)[A-Za-z][A-Za-z0-9.-]{3,}\b/)?.[0])
    .find((code) => Boolean(code));
  if (previousCode) {
    return `Mình đây 😄 Bạn muốn kiểm tra tiếp mã ${previousCode}, hay gửi ảnh/PDF để mình chuẩn bị gán cho sản phẩm đó?`;
  }
  if (previousUsers.some(isGreeting)) {
    return /^(?:hi){2,6}$|^hi hi$/.test(words)
      ? 'Hihi, mình nghe đây 😄 Bạn thử gửi một ảnh/PDF hoặc hỏi mã sản phẩm cụ thể nhé.'
      : 'Mình đây 👋 Bạn có thể hỏi sản phẩm nào thiếu ảnh, hoặc gửi file kèm mã để mình chuẩn bị gán.';
  }
  return /^(?:hi){2,6}$|^hi hi$/.test(words)
    ? 'Hihi, chào bạn 😄 Mình có thể tra sản phẩm trong project hoặc nhận ảnh/PDF để chuẩn bị gán. Bạn muốn thử gì?'
    : 'Chào bạn! Mình là Songbot. Mình có thể tra mã sản phẩm, tìm mục thiếu ảnh/PDF, hoặc nhận file để chuẩn bị gán. Bạn muốn bắt đầu việc nào?';
}
