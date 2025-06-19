export const getRandomId = () => `P2P_PLAYER_${Math.random().toString().slice(2, 8)}`;
export const getClientToken = () => `CLIENT_TOKEN_${Math.random().toString().slice(2, 8)}`;
export const splitByFirstUnderscore = str => {
  const match = str.match(/^([^_]*)_(.*)$/);
  if (match) {
    return [match[1], match[2]];
  } else {
    return [str];
  }
};
