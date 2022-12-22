<script lang="ts" setup>
import { useAlist, directoryItem } from 'src/composables/use-alist';
import { ref } from 'vue';
import { QSpinnerGears, useQuasar } from 'quasar';
import JSZip from 'jszip';
import ApkInfo from 'js-apk-parser';
import { useBinaryXmlParser } from 'src/composables/use-binary-xml-parser';
import { Buffer } from 'buffer';
import ListEditDialog from 'components/ListEditDialog.vue';
import LoginDialog from 'components/LoginDialog.vue';

// noinspection JSUnusedGlobalSymbols
const $q = useQuasar();

const alist = useAlist((message: string) => {
  $q.notify({
    message: message,
    icon: 'error_outline',
    color: 'negative',
  });
});

const BinaryXmlParser = useBinaryXmlParser((message: string) => {
  $q.notify({
    message: message,
    icon: 'warning_outline',
    color: 'warning',
  });
});

const state = ref('正在初始化');
const progress = ref(0);

const problemList = ref<Set<problem>>(new Set());

interface problem {
  type: string;
  name: string;
  path: string;
  description: string;
  suggestion: string;
  suggestionFun: () => void;
}

//分析文件
async function evaluate() {
  function moveFile(
    src_dir: string,
    dst_dir: string,
    name: string,
    item: problem
  ): void {
    $q.dialog({
      title: '确认信息',
      message: `确认将『${name}』从『${src_dir}』移动至『${dst_dir}』吗？`,
      cancel: true,
      persistent: true,
    }).onOk(async () => {
      await alist.move(src_dir, dst_dir, name);
      problemList.value.delete(item);
    });
  }

  function renameFile(
    dir: string,
    src_name: string,
    dst_name: string,
    item: problem
  ): void {
    $q.dialog({
      title: '确认信息',
      message: `确认将『${src_name}』重命名为『${dst_name}』吗？`,
      cancel: true,
      persistent: true,
    }).onOk(async () => {
      await alist.rename(dir + src_name, dst_name);
      problemList.value.delete(item);
    });
  }

  state.value = '正在加载分类';
  const galleryCategories: directoryItem[] = (await alist.list('/H₂O应用库/'))!;
  const developerCategories: directoryItem[] = (await alist.list(
    '/开发者专区/'
  ))!;
  const categories = galleryCategories.concat(developerCategories);
  state.value = '正在分析分类';
  progress.value = 0.01;
  const files: directoryItem[] = [];
  for (const [key, category] of categories.entries()) {
    if (!category.is_dir) {
      const item: problem = {
        type: 'error',
        description: '主目录下应当只有分类文件夹，这是一个文件',
        name: category.name,
        path: category.path,
        suggestion: '移动此文件到别处',
        suggestionFun: () => {
          $q.dialog({
            title: '移动',
            message: `将『${category.name}』移动至`,
            options: {
              type: 'radio',
              model: categories[0].path + categories[0].name + '/',
              // inline: true
              items: categories
                .map((item) => {
                  return item.is_dir
                    ? {
                        label: item.path + item.name + '/',
                        value: item.path + item.name + '/',
                      }
                    : {
                        label: '',
                        value: '',
                      };
                })
                .filter((item) => item.label),
            },
            cancel: true,
            persistent: true,
          }).onOk((dst_dir) => {
            moveFile(category.path, dst_dir, category.name, item);
          });
        },
      };
      problemList.value.add(item);
    } else if (
      category.name.replace(/ - .+?$/gi, '').replace(/[^\x00-\xff]/g, '00')
        .length > 10
    ) {
      if (category.name.replace(/ - .+?$/gi, '').match('By')) {
        const item: problem = {
          type: 'error',
          description: '作者等说明信息未置于分类说明中',
          name: category.name,
          path: category.path,
          suggestion: '添加分类说明',
          suggestionFun: () => {
            $q.dialog({
              title: '重命名',
              message: `将『${category.name}』重命名为`,
              prompt: {
                model: `${category.name.replace(' By ', ' - By ')}`,
              },
              cancel: true,
              persistent: true,
            }).onOk((name) => {
              renameFile(category.path, category.name, name, item);
            });
          },
        };
        problemList.value.add(item);
      } else if (category.name.match('（')) {
        const item: problem = {
          type: 'error',
          description: '说明信息被置于括号内，而不是分类说明中',
          name: category.name,
          path: category.path,
          suggestion: '将说明信息置于分类说明中',
          suggestionFun: () => {
            $q.dialog({
              title: '重命名',
              message: `将『${category.name}』重命名为`,
              prompt: {
                model: `${category.name
                  .replace('（', ' - ')
                  .replace('）', '')}`,
              },
              cancel: true,
              persistent: true,
            }).onOk((name) => {
              renameFile(category.path, category.name, name, item);
            });
          },
        };
        problemList.value.add(item);
      } else if (category.name.match('类')) {
        const item: problem = {
          type: 'error',
          description: '分类名称包含冗余字符『类』',
          name: category.name,
          path: category.path,
          suggestion: '移除冗余字符',
          suggestionFun: () => {
            $q.dialog({
              title: '重命名',
              message: `将『${category.name}』重命名为`,
              prompt: {
                model: `${category.name.replace('类', '')}`,
              },
              cancel: true,
              persistent: true,
            }).onOk((name) => {
              renameFile(category.path, category.name, name, item);
            });
          },
        };
        problemList.value.add(item);
      } else {
        const item: problem = {
          type: 'warning',
          description: '过长的分类名称',
          name: category.name,
          path: category.path,
          suggestion:
            '修改分类名称，如果无法准确说明请添加分类说明，请不要为独立应用建立分类',
          suggestionFun: () => {
            $q.dialog({
              title: '重命名',
              message: `将『${category.name}』重命名为`,
              prompt: {
                model: `${category.name}`,
              },
              cancel: true,
              persistent: true,
            }).onOk((name) => {
              renameFile(category.path, category.name, name, item);
            });
          },
        };
        problemList.value.add(item);
      }
    } else if (category.name.match('类')) {
      const item: problem = {
        type: 'error',
        description: '分类名称包含冗余字符『类』',
        name: category.name,
        path: category.path,
        suggestion: '移除冗余字符',
        suggestionFun: () => {
          $q.dialog({
            title: '重命名',
            message: `将『${category.name}』重命名为`,
            prompt: {
              model: `${category.name.replace('类', '')}`,
            },
            cancel: true,
            persistent: true,
          }).onOk((name) => {
            renameFile(category.path, category.name, name, item);
          });
        },
      };
      problemList.value.add(item);
    } else if (!category.name.match(' - ')) {
      const item: problem = {
        type: 'info',
        description: '缺少分类说明',
        name: category.name,
        path: category.path,
        suggestion: '添加分类说明',
        suggestionFun: () => {
          $q.dialog({
            title: '重命名',
            message: `为『${category.name}』添加分类说明`,
            prompt: {
              model: ``,
            },
            cancel: true,
            persistent: true,
          }).onOk((description) => {
            renameFile(
              category.path,
              category.name,
              `${category.name} - ${description}`,
              item
            );
          });
        },
      };
      problemList.value.add(item);
    }
    const filesOri = await alist.list(category.path + category.name + '/');
    Array.prototype.push.apply(files, filesOri!);
    progress.value = 0.01 + ((key + 1) / categories.length) * 0.89;
  }
  state.value = '正在分析文件';
  for (const [key, file] of files.entries()) {
    if (file.is_dir) {
      const item: problem = {
        type: 'error',
        description: '分类中应当只有安装包，这是一个文件夹',
        name: file.name,
        path: file.path,
        suggestion: '请把子分类移至应用库根目录中',
        suggestionFun: () => {
          $q.dialog({
            title: '移动',
            message: `将『${file.name}』移动至`,
            options: {
              type: 'radio',
              model: '/H₂O应用库/',
              // inline: true
              items: [
                { label: '/H₂O应用库/', value: '/H₂O应用库/' },
                { label: '/开发者专区/', value: '/开发者专区/' },
              ],
            },
            cancel: true,
            persistent: true,
          }).onOk((data) => {
            moveFile(file.path, data, file.name, item);
          });
        },
      };
      problemList.value.add(item);
    } else if (!file.name.match(/(?<= - ).+\(\d+\)(?=( - (.+))?\.apk)/gi)) {
      const item: problem = {
        type: 'error',
        description: '缺少版本号',
        name: file.name,
        path: file.path,
        suggestion: '添加版本号',
        suggestionFun: async () => {
          const dialog = $q.dialog({
            title: '正在获取版本号',
            message: '正在开始下载',
            progress: {
              spinner: QSpinnerGears,
            },
            persistent: true, // we want the user to not be able to close it
            ok: false, // we want the user to not be able to close it
          });

          try {
            const fileInfo = await alist.get(`${file.path}${file.name}`);

            const response = await fetch(fileInfo!.raw_url);

            const reader = response.body!.getReader();

            // Step 2：获得总长度（length）
            const contentLength = +response.headers.get('Content-Length')!;

            // Step 3：读取数据
            let receivedLength = 0; // 当前接收到了这么多字节
            let chunks = []; // 接收到的二进制块的数组（包括 body）
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                break;
              }

              chunks.push(value);
              receivedLength += value.length;

              dialog.update({
                message: `下载中：${
                  Math.floor((receivedLength / contentLength) * 10000) / 100
                }%（${
                  Math.floor((receivedLength / 1024 / 1024) * 100) / 100
                }MB/${
                  Math.floor((contentLength / 1024 / 1024) * 100) / 100
                }MB）`,
              });
            }

            dialog.update({
              message: `下载完成，正在解析`,
            });

            // Step 4：将块连接到单个 Uint8Array
            let chunksAll = new Uint8Array(receivedLength); // (4.1)
            let position = 0;
            for (let chunk of chunks) {
              chunksAll.set(chunk, position); // (4.2)
              position += chunk.length;
            }

            const zip = await JSZip.loadAsync(new Blob([chunksAll]));

            const xmlBuffer = await zip.files['AndroidManifest.xml'].async(
              'arraybuffer'
            );
            const parser = new BinaryXmlParser(Buffer.from(xmlBuffer));

            const manifestBuffer = await zip.files['AndroidManifest.xml'].async(
              'arraybuffer'
            );

            const arscBuffer = await zip.files['resources.arsc'].async(
              'arraybuffer'
            );

            const apkInfo = new ApkInfo(manifestBuffer, arscBuffer);

            const xmlAttrs = parser.parse()!.attributes;

            const apkVersion = { versionName: '', versionCode: 0 };

            xmlAttrs.forEach((item) => {
              apkVersion[item['name']] = item['typedValue']['value'];
            });

            dialog.update({
              message: `解析完成`,
            });

            dialog.hide();

            let oriName = file.name.match(
              /(?<=(【.+】)?).+(?=( - .+)?( - .+)?( By .+)?\.apk)/gi
            )![0];

            let description = '';

            if (oriName.match(/（.+）/gi)) {
              description = ' - ' + oriName.match(/(?<=（).+(?=）)/gi);
              oriName = oriName.replace(/（.+）/gi, '');
            }

            if (oriName !== apkInfo.getLabel()) {
              $q.dialog({
                title: '应用名不符',
                message: `要将应用名从『${oriName}』改为『${apkInfo.getLabel()}』吗`,
                cancel: true,
                persistent: true,
              }).onOk(() => {
                $q.dialog({
                  title: '添加版本号',
                  message: `为『${file.name}』添加版本号`,
                  prompt: {
                    model: `${apkVersion.versionName}(${apkVersion.versionCode})`,
                  },
                  cancel: true,
                  persistent: true,
                }).onOk((data) => {
                  renameFile(
                    file.path,
                    file.name,
                    file.name
                      .replace(
                        /(?<=(【.+】)?).+(?=( - .+)?( - .+)?( By .+)?\.apk)/gi,
                        apkInfo.getLabel()
                      )
                      .replace('.apk', ` - ${data}.apk`)
                      .replace(
                        '.apk',
                        `${
                          (file.name
                            .replace('.apk', ` - ${data}.apk`)
                            .match(/(?<=.+) - .+(?= - .+(.+)\.apk)/gi) ?? [
                            '',
                          ])[0]
                        }.apk`
                      )
                      .replace(/(?<=.+) - .+(?= - .+(.+) - .+\.apk)/gi, '')
                      .replace('.apk', `${description}.apk`),
                    item
                  );
                });
              });
            }
          } catch (e) {
            $q.notify({
              message: (e as Error).message,
              icon: 'error_outline',
              color: 'error',
            });
          }
        },
      };
      problemList.value.add(item);
    } else if (file.name.match(/（.+）.* - .+\.apk/gi)) {
      const item: problem = {
        type: 'error',
        description: '说明信息被置于括号内，而不是应用说明中',
        name: file.name,
        path: file.path,
        suggestion: '将说明信息置于应用说明中',
        suggestionFun: () => {
          $q.dialog({
            title: '重命名',
            message: `将『${file.name}』重命名为`,
            prompt: {
              model: `${file.name
                .replace(
                  '.apk',
                  ` - ${
                    (file.name.match(/(?<=（).+(?=）.* - .+\.apk)/gi) ?? [
                      '',
                    ])[0]
                  }.apk`
                )
                .replace(/（.+）/gi, '')}`,
            },
            cancel: true,
            persistent: true,
          }).onOk((name) => {
            renameFile(file.path, file.name, name, item);
          });
        },
      };
      problemList.value.add(item);
    } else if (file.name.match(/【.+( Ⅰ .+)+】/gi)) {
      const item: problem = {
        type: 'warning',
        description: '标签格式错误',
        name: file.name,
        path: file.path,
        suggestion: '更正标签分隔符',
        suggestionFun: () => {
          $q.dialog({
            component: ListEditDialog,
            componentProps: {
              title: '重命名',
              message: `为『${file.path}』修改标签`,
              list: file.name.match(/(?<=【).+(?=】)/gi)![0].split(' Ⅰ '),
            },
          }).onOk(async (tags) => {
            renameFile(
              file.path,
              file.name,
              file.name.replace(/^【.+】/gi, `【${tags.join(' · ')}】`),
              item
            );
          });
        },
      };
      problemList.value.add(item);
    } else if (!file.name.match(/.+ - .+ - .+\.apk/gi)) {
      const item: problem = {
        type: 'info',
        description: '缺少应用说明',
        name: file.name,
        path: file.path,
        suggestion: '添加应用说明',
        suggestionFun: () => {
          $q.dialog({
            title: '添加应用说明',
            message: `为『${file.name}』添加应用说明`,
            prompt: {
              model: ``,
            },
            cancel: true,
            persistent: true,
          }).onOk(async (name) => {
            renameFile(
              file.path,
              file.name,
              file.name.replace('.apk', ` - ${name}.apk`),
              item
            );
          });
        },
      };
      problemList.value.add(item);
    } else if (!file.name.match(/【.+( · .+)*】/gi)) {
      const item: problem = {
        type: 'info',
        description: '缺少标签',
        name: file.name,
        path: file.path,
        suggestion: '添加标签',
        suggestionFun: () => {
          $q.dialog({
            component: ListEditDialog,
            componentProps: {
              title: '添加标签',
              message: `为『${file.path}』添加标签`,
            },
          }).onOk(async (tags) => {
            renameFile(
              file.path,
              file.name,
              `【${tags.join(' · ')}】${file.name}`,
              item
            );
          });
        },
      };
      problemList.value.add(item);
    } else if (!file.name.match(/ By .+\.apk/gi)) {
      const item: problem = {
        type: 'info',
        description: '缺少作者',
        name: file.name,
        path: file.path,
        suggestion: '添加作者',
        suggestionFun: () => {
          $q.dialog({
            title: '添加作者',
            message: `为『${file.name}』添加作者`,
            prompt: {
              model: ``,
            },
            cancel: true,
            persistent: true,
          }).onOk(async (name) => {
            renameFile(
              file.path,
              file.name,
              file.name.replace('.apk', ` By ${name}.apk`),
              item
            );
          });
        },
      };
      problemList.value.add(item);
    }
    progress.value = 0.9 + ((key + 1) / files.length) * 0.1;
  }
  state.value = '分析完成';
}

$q.dialog({
  component: LoginDialog,
}).onOk(async ({ user, pass }) => {
  await alist.auth(user, pass);
  await evaluate();
});

const card = {
  classes: {
    info: 'bg-info text-white',
    warning: 'bg-warning text-black',
    error: 'bg-negative text-white',
  },
  icon: {
    warning: 'warning_amber',
    error: 'error_outline',
    info: 'info_outline',
  },
};
</script>

<template>
  <q-page class="column text-body1">
    <q-card
      class="text-white"
      style="
        background-image: linear-gradient(135deg, #f97794 10%, #623aa2 100%);
      "
    >
      <q-card-section>
        <div
          class="text-h3 text-center"
          style="font-family: 'Comfortaa-Light', sans-serif; line-height: 5rem"
        >
          Dreamship App Gallery Tool
        </div>
      </q-card-section>
    </q-card>

    <q-card>
      <q-card-section>
        <div class="text-subtitle2">当前状态：{{ state }}</div>
        <q-linear-progress :value="progress" />
      </q-card-section>
    </q-card>

    <q-card class="bg-secondary text-white">
      <q-card-section>
        <div class="text-h6 row no-wrap items-center">
          <div class="ellipsis text-capitalize">命名规范</div>
          <q-space></q-space>
          <q-icon name="help_outline"></q-icon>
        </div>
      </q-card-section>
      <q-separator inset size="2px" />
      <q-card-section>
        <ul>
          <li>
            总括
            <ul>
              <li>原则：言简意赅、直观形象、格式统一</li>
              <li>
                空格：在且仅在以下位置使用空格
                <ul>
                  <li>『英文字母、英文标点、数字』与『汉字』之间</li>
                  <li>用于分隔语块的连字符左右</li>
                  <li>应用名称本身包含空格时</li>
                  <li>
                    注意：不要使用空格替代连字符，这在很多情况下会造成困扰
                  </li>
                </ul>
              </li>
            </ul>
          </li>
          <li>
            分类
            <ul>
              <li>格式：分类名[ - 分类说明]</li>
              <li>示例：模块 - 须搭配 LSPatch 使用</li>
              <li>
                说明：
                <ul>
                  <li>分类说明：可选。尽可能添加，要求语言简洁明了</li>
                  <li>
                    分类名：必需。应尽可能简洁，不要包含『类』这样的无效字眼，至多
                    10 个字节（5 个汉字/10 个字母）
                  </li>
                  <li>
                    如果感觉分类名表达不准确，请添加分类说明，而不是使用更长的分类名
                  </li>
                </ul>
              </li>
            </ul>
          </li>
          <li>
            应用
            <ul>
              <li>
                格式：[【标签一·标签二】]应用名称 - 版本号[ - 应用介绍 by
                开发者]
              </li>
              <li>
                示例：【模块·安卓·Wear】应用配置 - 1.0.0(1) -
                一个类似『应用变量』的可在宿主应用内完成配置的适用于『LSPatch
                便携模式』的模块 by 吉王义昊
              </li>
              <li>
                说明：
                <ul>
                  <li>
                    标签：可选。应尽可能简洁，每个标签至多 8
                    个字节。应当保持统一，不应出现语意重复的标签
                  </li>
                  <li>
                    应用名称：必需。与应用的显示名称保持一致（如果出现了此处使用的标识符号【】·-另行讨论）。如果该应用的常见名称与显示名称不一致，请在应用介绍中说明
                  </li>
                  <li>
                    版本号：必需。与应用的显示版本号一致（如果出现了此处使用的标识符号【】·-另行讨论）
                  </li>
                  <li>应用介绍：可选。对应用的简短介绍，尽量写</li>
                  <li>
                    开发者：可选。应用的开发者。应尽可能添加（即使在开发者专区中）
                  </li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </q-card-section>
    </q-card>

    <transition-group name="list" tag="ul" class="transition">
      <li v-for="item in problemList" :key="item.path">
        <q-card :class="card.classes[item.type]">
          <q-card-section>
            <div class="text-h6 row no-wrap items-center">
              <div class="ellipsis">{{ item.name }}</div>
              <q-space></q-space>
              <q-icon :name="card.icon[item.type]"></q-icon>
            </div>
          </q-card-section>
          <q-separator inset size="2px" />
          <q-card-section>
            <ul>
              <li>文件路径：{{ item.path }}</li>
              <li>问题描述：{{ item.description }}</li>
              <li>建议的修改：{{ item.suggestion }}</li>
            </ul>
          </q-card-section>
          <q-card-actions class="justify-end">
            <q-btn flat @click="problemList.delete(item)">忽略</q-btn>
            <q-btn flat @click="item.suggestionFun">应用推荐的修改</q-btn>
          </q-card-actions>
        </q-card>
      </li>
    </transition-group>

    <q-card v-if="problemList.size === 0" class="bg-positive text-white">
      <q-card-section>
        <div class="text-h6 row no-wrap items-center">
          <div class="ellipsis">没有问题</div>
          <q-space></q-space>
          <q-icon name="check_circle_outline"></q-icon>
        </div>
      </q-card-section>
      <q-separator inset size="2px" />
      <q-card-section> WOW，没有问题！</q-card-section>
      <q-card-actions class="justify-end">
        <q-btn flat @click="evaluate()">重新扫描</q-btn>
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<style lang="scss" scoped>
.q-page > * {
  margin: 12px;
  width: calc(100% - 24px);
}

ul {
  margin: 0;
  padding-inline-start: 20px;
}

.transition {
  padding: 0;
  list-style: none;
  position: relative;
  margin: -12px 12px 12px 12px;

  > li {
    margin: 24px 0;
  }
}

.list-move, /* 对移动中的元素应用的过渡 */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

/* 确保将离开的元素从布局流中删除
  以便能够正确地计算移动的动画。 */
.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>

<!--suppress CssUnusedSymbol -->
<style>
.q-icon.notranslate.material-icons.q-notification__icon.q-notification__icon--additional {
  justify-content: space-between;
}
</style>
