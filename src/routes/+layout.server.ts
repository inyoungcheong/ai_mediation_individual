
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
  // 인증이 필요 없는 경우 빈 객체 반환
  return {
    session: null
  };
};