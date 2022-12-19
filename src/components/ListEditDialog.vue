<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import { computed, ref, watch, watchEffect } from 'vue';

const props = defineProps({
  // ...your custom props
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  list: {
    type: Array,
    default: () => [],
  },
});

defineEmits([
  // REQUIRED; need to specify some events that your
  // component will emit through useDialogPluginComponent()
  ...useDialogPluginComponent.emits,
]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
// dialogRef      - Vue ref to be applied to QDialog
// onDialogHide   - Function to be used as handler for @hide on QDialog
// onDialogOK     - Function to call to settle dialog with "ok" outcome
//                    example: onDialogOK() - no payload
//                    example: onDialogOK({ /*...*/ }) - with payload
// onDialogCancel - Function to call to settle dialog with "cancel" outcome

// this is part of our example (so not required)
function onOKClick() {
  // on OK, it is REQUIRED to
  // call onDialogOK (with optional payload)
  onDialogOK(
    typeList.value.map((item) => item.item).filter((item) => item !== '')
  );
  // or with payload: onDialogOK({ ... })
  // ...and it will also hide the dialog automatically
}

const typeList = ref(
  props.list.map((item) => {
    return {
      item,
    };
  })
);

watch(
  typeList,
  () => {
    console.log(typeList);
    if (
      typeList.value.length !==
      typeList.value.filter((item) => item.item !== '').length + 1
    ) {
      typeList.value = typeList.value.filter((item) => item.item !== '');
      typeList.value.push({ item: '' });
    }
  },
  { deep: true }
);
typeList.value = typeList.value.filter((item) => item.item !== '');
typeList.value.push({ item: '' });
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <!--
        ...content
        ... use q-card-section for it?
      -->
      <q-card-section class="q-dialog__title">
        {{ title }}
      </q-card-section>

      <q-card-section class="q-dialog__message">
        {{ message }}
      </q-card-section>

      <q-card-section class="scroll q-dialog-plugin__form q-gutter-sm">
        <q-input
          v-for="(typeItem, key) in typeList"
          dense
          standout="bg-primary text-white"
          v-model="typeItem.item"
          label="请输入标签"
          :key="key"
        />
      </q-card-section>

      <!-- buttons example -->
      <q-card-actions align="right">
        <q-btn color="primary" flat label="Cancel" @click="onDialogCancel" />
        <q-btn color="primary" flat label="OK" @click="onOKClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
