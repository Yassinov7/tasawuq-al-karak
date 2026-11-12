const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { load } = require("./syp-test-loader.cjs");

const mp4 = Uint8Array.from([0, 0, 0, 24, ...Buffer.from("ftypisom"), 0, 0, 0, 0, ...Buffer.from("isomavc1")]);
const jpg = Uint8Array.from([255, 216, 255, 0]);
const files = new Map([["video", mp4], ["poster", jpg], ["image", jpg]]);
const platform = { OS: "android" };
let asset = { uri: "video", mimeType: "application/octet-stream", fileName: "demo.mp4", duration: 2000 };
let pickerError, cancelled = false, requests = 0, granted = true, mediaTypes, readsClosed = 0;
class File {
  constructor(uri) { this.uri = uri; }
  get size() { return files.get(this.uri).length; }
  open() { return { readBytes: () => files.get(this.uri), close: () => { readsClosed++; } }; }
  async arrayBuffer() { return files.get(this.uri).buffer; }
  delete() { files.delete(this.uri); }
}
const storageCalls = [];
let failUpload;
const storage = {
  async upload(path, _, opts) { storageCalls.push([path, opts.contentType]); return { error: opts.contentType === failUpload }; },
  async remove(paths) { storageCalls.push(["removed", ...paths]); },
};
const mocks = {
  "expo-file-system": { File, FileMode: { ReadOnly: "r" } },
  "react-native": { Platform: platform },
  "expo-image-picker": {
    async requestMediaLibraryPermissionsAsync() { requests++; return { granted, canAskAgain: false }; },
    async launchImageLibraryAsync(options) {
      mediaTypes = options.mediaTypes;
      if (pickerError) throw pickerError;
      return cancelled ? { canceled: true } : { canceled: false, assets: asset ? [asset] : [] };
    },
  },
  "@/lib/personal-account": { assertAccount: async () => {} },
  "@/lib/supabase": { supabase: { storage: { from: () => storage } } },
  "@/lib/request-key": { newIdempotencyKey: () => "version" },
};
const { pickHomeAdMedia } = load("src/lib/home-ad-picker.ts", mocks);
const { uploadHomeAd } = load("src/lib/customer-home-ads.ts", mocks);

async function testThumbnail() {
  let timer, allowLoad, delayedLoad, failDecode, closeCount = 0;
  const frames = [];
  const frame = { release() { frames.push("release"); } };
  const player = {
    replaceAsync: () => delayedLoad ? new Promise(resolve => { allowLoad = resolve; }) : Promise.resolve(),
    async generateThumbnailsAsync([seconds]) {
      frames.push(seconds);
      if (failDecode || seconds > 0) throw Error("decode failure");
      return [frame];
    },
    release() { closeCount++; },
  };
  const native = {
    ...mocks,
    "expo-video": { createVideoPlayer: () => player },
    "expo-image-manipulator": {
      SaveFormat: { JPEG: "jpeg" },
      ImageManipulator: { manipulate: () => ({
        async renderAsync() {
          return { async saveAsync() { return { uri: "poster" }; }, release() {} };
        },
        release() {},
      }) },
    },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/home-ad-thumbnail.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, require: name => native[name],
    setTimeout(fn) { timer = fn; return 1; }, clearTimeout() {},
  });
  assert.equal(await exports.createHomeAdThumbnail("video", 2000), "poster");
  assert.deepEqual(frames.splice(0), [0.4, 0, "release"]);
  assert.equal(closeCount, 1);
  failDecode = true;
  await assert.rejects(exports.createHomeAdThumbnail("video", 2000), /تعذر قراءة إطار/);
  assert.equal(closeCount, 2);
  assert.deepEqual(frames.splice(0), [0.4, 0]);
  delayedLoad = true;
  const pending = exports.createHomeAdThumbnail("video");
  timer();
  await assert.rejects(pending, /انتهت مهلة استخراج/);
  assert.equal(closeCount, 2, "cannot release while native replaceAsync is pending");
  allowLoad();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closeCount, 3);
  assert.equal(frames.length, 0, "timed-out jobs cannot start decoding later");
}

async function main() {
  const video = await pickHomeAdMedia("videos");
  assert.equal(video.mime, "video/mp4");
  assert.equal(video.uri, "video");
  assert.equal(requests, 0);
  assert.equal(mediaTypes.join(), "videos");
  assert.equal(readsClosed, 1);
  cancelled = true;
  assert.equal(await pickHomeAdMedia("videos"), undefined);
  cancelled = false;
  pickerError = Error("unavailable");
  await assert.rejects(pickHomeAdMedia("videos"), /منتقي الفيديو/);
  pickerError = { code: "ERR_FAILED_TO_EXTRACT_VIDEO_METADATA" };
  await assert.rejects(pickHomeAdMedia("videos"), /تعذر استلام الملف/);
  pickerError = undefined;
  asset = null;
  await assert.rejects(pickHomeAdMedia("videos"), /لم يُرجع المنتقي/);
  asset = { uri: "missing" };
  await assert.rejects(pickHomeAdMedia("videos"), /تعذرت قراءة الملف/);
  asset = { uri: "image", mimeType: "video/mp4" };
  await assert.rejects(pickHomeAdMedia("videos"), /ليس فيديو MP4/);
  assert.equal((await pickHomeAdMedia("images")).mime, "image/jpeg");
  platform.OS = "ios";
  granted = false;
  await assert.rejects(pickHomeAdMedia("videos"), /إعدادات iPhone/);
  assert.equal(requests, 1);
  granted = true;
  asset = { uri: "video" };
  assert.equal((await pickHomeAdMedia("videos")).mime, "video/mp4");

  const uploaded = await uploadHomeAd("admin", "ad", video.uri, video.mime, "poster");
  assert.equal(uploaded.media_path, "ad/version.mp4");
  assert.equal(uploaded.thumbnail_path, "ad/version.jpg");
  assert.deepEqual(storageCalls.splice(0), [["ad/version.jpg", "image/jpeg"], ["ad/version.mp4", "video/mp4"]]);
  failUpload = "image/jpeg";
  await assert.rejects(uploadHomeAd("admin", "ad", video.uri, video.mime, "poster"), /رفع الصورة المصغرة/);
  assert.equal(storageCalls.splice(0).length, 1);
  failUpload = "video/mp4";
  await assert.rejects(uploadHomeAd("admin", "ad", video.uri, video.mime, "poster"), /رفع الفيديو/);
  assert.equal(storageCalls.at(-1).join(), "removed,ad/version.jpg");
  failUpload = undefined;
  assert.equal((await uploadHomeAd("admin", "ad", "image", "image/jpeg")).thumbnail_path, null);
  await testThumbnail();
  console.log("PASS thumbnail retry and native release after timeout; Android/iOS picker branches, content-based MP4, cancellation, distinct thumbnail/video paths, upload errors and image compatibility");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
