import { createClient } from 'webdav/web';

// 按照惯例，组合式函数名以“use”开头
export function useWebdav() {
  return createClient('/dav', {
    username: 'alist',
    password: 'alist',
  });
}
