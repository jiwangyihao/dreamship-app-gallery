// 按照惯例，组合式函数名以“use”开头
export function useAlist(onError: (message: string) => void) {
  return new AlistClient({
    host: 'https://app.moyu.group',
    onError: onError,
  });
}

class AlistClient {
  token: string;
  host: string;
  onError: (message: string) => void;

  constructor(config: alistClientConfig) {
    this.host = config.host;
    this.token = '';
    this.onError = config.onError;
  }

  async auth(user: string, pass: string) {
    try {
      const formData = new FormData();
      formData.append('Username', user);
      formData.append('Password', pass);
      return (this.token = await fetch(`${this.host}/api/auth/login`, {
        method: 'POST',
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => data.data.token));
    } catch (e) {
      this.onError((e as Error).message);
    }
  }

  async list(path: string): Promise<directoryItem[] | undefined> {
    try {
      return (
        await (
          await fetch(`${this.host}/api/fs/list`, {
            method: 'POST',
            body: JSON.stringify({
              path: path,
            }),
            headers: {
              'content-type': 'application/json;charset=UTF-8',
              Authorization: this.token,
            },
          })
        ).json()
      ).data.content.map((item: directoryItem) => {
        item.path = path;
        return item;
      });
    } catch (e) {
      this.onError((e as Error).message);
    }
  }

  async copy(src_dir: string, dst_dir: string, name: string): Promise<void> {
    try {
      const message = (
        await (
          await fetch(`${this.host}/api/fs/copy`, {
            method: 'POST',
            body: JSON.stringify({
              src_dir,
              dst_dir,
              names: [name],
            }),
            headers: {
              'content-type': 'application/json;charset=UTF-8',
              Authorization: this.token,
            },
          })
        ).json()
      ).message;
      if (message !== 'success') {
        this.onError(message);
      }
    } catch (e) {
      this.onError((e as Error).message);
    }
  }

  async remove(dir: string, name: string): Promise<void> {
    try {
      const message = (
        await (
          await fetch(`${this.host}/api/fs/remove`, {
            method: 'POST',
            body: JSON.stringify({
              dir,
              names: [name],
            }),
            headers: {
              'content-type': 'application/json;charset=UTF-8',
              Authorization: this.token,
            },
          })
        ).json()
      ).message;
      if (message !== 'success') {
        this.onError(message);
      }
    } catch (e) {
      this.onError((e as Error).message);
    }
  }

  async move(src_dir: string, dst_dir: string, name: string): Promise<void> {
    try {
      const message = (
        await (
          await fetch(`${this.host}/api/fs/move`, {
            method: 'POST',
            body: JSON.stringify({
              src_dir,
              dst_dir,
              names: [name],
            }),
            headers: {
              'content-type': 'application/json;charset=UTF-8',
              Authorization: this.token,
            },
          })
        ).json()
      ).message;
      if (message.match('try to copy')) {
        await this.copy(src_dir, dst_dir, name);
        await this.remove(src_dir, name);
      } else if (message !== 'success') {
        this.onError(message);
      }
    } catch (e) {
      this.onError((e as Error).message);
    }
  }

  async rename(path: string, name: string): Promise<void> {
    try {
      const message = (
        await (
          await fetch(`${this.host}/api/fs/rename`, {
            method: 'POST',
            body: JSON.stringify({
              path,
              name,
            }),
            headers: {
              'content-type': 'application/json;charset=UTF-8',
              Authorization: this.token,
            },
          })
        ).json()
      ).message;
      if (message.match('try to copy')) {
      } else if (message !== 'success') {
        this.onError(message);
      }
    } catch (e) {
      this.onError((e as Error).message);
    }
  }

  async get(path: string): Promise<fileInfo | undefined> {
    try {
      return (
        await (
          await fetch(`${this.host}/api/fs/get`, {
            method: 'POST',
            body: JSON.stringify({
              path: path,
            }),
            headers: {
              'content-type': 'application/json;charset=UTF-8',
              Authorization: this.token,
            },
          })
        ).json()
      ).data;
    } catch (e) {
      this.onError((e as Error).message);
    }
  }
}

export interface alistClientConfig {
  host: string;
  onError: (message: string) => void;
}

export interface directoryItem {
  name: string;
  size: number;
  is_dir: boolean;
  modified: string;
  sign: string;
  thumb: string;
  type: number;
  path: string;
}

export interface fileInfo {
  is_dir: boolean;
  modified: string;
  name: string;
  provider: string;
  raw_url: string;
  readme: string;
  sign: string;
  size: number;
  thumb: string;
  type: number;
}
