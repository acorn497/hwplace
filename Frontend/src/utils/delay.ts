export const delay = async (delay: number) => {
  return await new Promise(resolve => setTimeout(resolve, delay));
};