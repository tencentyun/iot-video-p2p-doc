import CryptoJS from '../vendor/crypto.min.js';
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

export const appendSignature = ({ AppSecret, ...otherData }) => {
  const Timestamp = Math.floor(Date.now() / 1000);
  const Nonce = Math.floor(10000 * Math.random()) + 1; // 随机正整数

  const tempData = {
    Timestamp,
    Nonce,
    ...otherData,
  };

  const keys = Object.keys(tempData).sort();
  const arr = keys
    .filter(key => tempData[key] !== undefined && !!String(tempData[key]))
    .map(key => `${key}=${tempData[key]}`);
  const paramString = arr.join('&');
  const hash = CryptoJS.HmacSHA1(paramString, AppSecret);
  const signature = CryptoJS.enc.Base64.stringify(hash);
  return {
    ...tempData,
    Signature: signature,
  };
};
