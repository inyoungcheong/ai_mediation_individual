// Mock KV for development - replaces Vercel KV dependency
export const kv = {
  async hmset(key: string, data: any) {
    console.log('Mock KV hmset:', key, data);
    return true;
  },
  
  async zadd(key: string, data: any) {
    console.log('Mock KV zadd:', key, data);
    return true;
  },
  
  async hgetall(key: string) {
    console.log('Mock KV hgetall:', key);
    return {};
  },
  
  async zrange(key: string, start: number, stop: number) {
    console.log('Mock KV zrange:', key, start, stop);
    return [];
  }
};