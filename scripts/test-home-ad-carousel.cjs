const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { load } = require("./syp-test-loader.cjs");
const policy = load("src/lib/home-ad-carousel.ts");
assert.equal(policy.nextAdIndex(2, 3, 1), 0);
assert.equal(policy.adSwipeDirection(35), null);
assert.equal(policy.adSwipeDirection(-40), -1);

function harness() {
  const slots = [];
  let cursor, pending;
  const same = (a, b) => a?.length === b?.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(init) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof init === "function" ? init() : init };
      const slot = slots[index];
      return [slot.value, next => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
    },
    useRef(init) { return (slots[cursor++] ??= { current: init }); },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: fn, deps };
      return slots[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) {
        pending.push(() => {
          slots[index]?.cleanup?.();
          slots[index] = { deps, cleanup: fn() };
        });
      }
    },
  };
  return {
    react,
    render(fn) { cursor = 0; pending = []; const value = fn(); pending.forEach(run => run()); return value; },
    dispose() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

const jsx = (type, props) => ({ type, props });
const timers = new Map();
let focused = true, foreground, reduce, reader, nextTimer = 0, plays = 0, pauses = 0, playerSetup;
const banner = harness();
let video = harness();
let released = false;
const listeners = new Map();
let activeHooks = banner.react;
const player = { play() { assert.equal(released, false, "play after native release"); plays++; }, pause() { assert.equal(released, false, "pause after native release"); pauses++; }, status: "readyToPlay",
  addListener(name, callback) { listeners.set(name, callback); return { remove() { listeners.delete(name); } }; } };
const mocks = {
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  react: new Proxy({}, { get: (_, name) => activeHooks[name] }),
  "expo-router": { useIsFocused: () => focused },
  "expo-video": { VideoView: "VideoView", useVideoPlayer: (_, setup) => { setup(player); playerSetup = player; return player; } },
  "react-native": {
    View: "View", Pressable: "Pressable", Text: "Text", Platform: { OS: "android" },
    StyleSheet: { create: styles => styles, absoluteFill: {} },
    AppState: { currentState: "active", addEventListener: (_, fn) => { foreground = fn; return { remove() {} }; } },
    Animated: { View: "AnimatedView", Value: class { setValue() {} }, timing: () => ({ start() {}, stop() {} }) },
    AccessibilityInfo: {
      isReduceMotionEnabled: async () => false, isScreenReaderEnabled: async () => false,
      addEventListener: (event, fn) => { if (event === "reduceMotionChanged") reduce = fn; else reader = fn; return { remove() {} }; },
    },
  },
  "@/components/marketplace/ShoppingCardImage": { ShoppingCardImage: "Image" },
  "@/constants/theme": { Fonts: {}, FontSizes: {}, Radius: {}, Spacing: {} },
  "@/context/ThemeContext": { useTheme: () => ({ colors: {} }) },
  "@/lib/home-ad-carousel": policy,
};

const code = ts.transpileModule(fs.readFileSync("src/components/home/CustomerHomeSponsored.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const exportsObject = {};
vm.runInNewContext(code, {
  exports: exportsObject, require: name => mocks[name],
  setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
  clearTimeout: id => timers.delete(id),
});
const ads = [
  { id: "photo", title: "صورة", media_kind: "image", mediaKey: "photo-v1", url: "photo" },
  { id: "movie", title: "فيديو", media_kind: "video", mediaKey: "movie-v1", url: "movie", thumbnailUrl: "poster" },
];
let opened;
const render = (data = ads) => banner.render(() => exportsObject.CustomerHomeSponsored({ ads: data, onOpen: ad => { opened = ad.id; } }));
const hit = view => view.props.children.props;
const media = view => hit(view).children.props.children[0];
function fire(delay) {
  assert.equal(timers.size, 1);
  const [[id, timer]] = timers;
  assert.equal(timer.delay, delay);
  timers.delete(id);
  timer.fn();
}

async function main() {
  let view = render([ads[0]]);
  await Promise.resolve();
  view = render([ads[0]]);
  assert.equal(timers.size, 0, "a single image has no carousel timer");
  assert.equal(view.props.style[0].aspectRatio, 16 / 9);
  assert.match(hit(view).accessibilityLabel, /صورة/);
  render();
  const scheduled = nextTimer;
  render();
  assert.equal(nextTimer, scheduled, "stable render does not schedule another rotation");
  fire(5000);
  view = render();
  assert.match(hit(view).accessibilityLabel, /فيديو/);
  assert.equal(media(view).props.poster.props.children.props.uri, "poster");
  activeHooks = video.react;
  const renderVideo = () => video.render(() => media(view).type(media(view).props));
  let playback = renderVideo();
  assert.equal(playerSetup.muted, true);
  assert.equal(playerSetup.staysActiveInBackground, false);
  assert.equal(plays, 1);
  assert.equal(playback.props.children[0].props.nativeControls, false);
  assert.ok(playback.props.children[1], "poster covers the player until its first frame");
  playback.props.children[0].props.onFirstFrameRender();
  playback = renderVideo();
  assert.equal(playback.props.children[1], null);
  released = true; // Expo's hook releases before BannerVideo's passive effect cleanups.
  video.dispose();
  assert.equal(pauses, 0);
  assert.equal(listeners.size, 0);
  released = false;
  activeHooks = banner.react;
  fire(15000);
  view = render();
  assert.match(hit(view).accessibilityLabel, /صورة/);

  hit(view).onPressIn();
  view = render();
  assert.equal(timers.size, 0);
  hit(view).onPressOut();
  view = render();
  const touch = (pageX, pageY) => ({ nativeEvent: { pageX, pageY } });
  view.props.onTouchStart(touch(40, 40));
  assert.equal(view.props.onMoveShouldSetResponderCapture(touch(46, 75)), false);
  assert.equal(view.props.onMoveShouldSetResponderCapture(touch(95, 43)), true);
  view.props.onResponderGrant();
  view.props.onResponderRelease(touch(95, 43));
  view = render();
  assert.match(hit(view).accessibilityLabel, /فيديو/);
  assert.equal(media(view).props.children.props.uri, "poster", "automatic cycles do not restart a played stream");
  hit(view).onPress();
  assert.equal(opened, "movie");
  focused = false;
  render();
  assert.equal(timers.size, 0);
  focused = true;
  foreground("background"); render();
  assert.equal(timers.size, 0);
  foreground("active"); reduce(true); render();
  assert.equal(timers.size, 0);
  reduce(false); reader(true); render();
  assert.equal(timers.size, 0);
  reader(false);
  const replacement = [ads[0], { ...ads[1], mediaKey: "movie-v2", thumbnailUrl: "new-poster" }];
  view = render(replacement);
  media(view).props.onRetire();
  view = render(replacement);
  assert.equal(media(view).props.children.props.uri, "new-poster");
  assert.equal(render([]), null);
  // Each path actually mounts the player, changes the carousel, and retires the native object.
  for (const reason of ["ended", "timer", "swipe", "search", "background", "removed"]) {
    const current = [{ ...ads[1], id: "movie-" + reason, mediaKey: "movie-" + reason }, ads[0]];
    activeHooks = banner.react;
    render([current[0]]);
    view = render([current[0], { ...current[1], id: "photo-" + reason }]);
    video = harness();
    activeHooks = video.react;
    const mounted = video.render(() => media(view).type(media(view).props));
    mounted.props.children[0].props.onFirstFrameRender();
    activeHooks = banner.react;
    if (reason === "ended") listeners.get("playToEnd")();
    if (reason === "timer") fire(15000);
    if (reason === "swipe") {
      const touch = (pageX) => ({ nativeEvent: { pageX, pageY: 40 } });
      view.props.onTouchStart(touch(30));
      view.props.onResponderGrant();
      view.props.onResponderRelease(touch(90));
    }
    if (reason === "search") focused = false;
    if (reason === "background") foreground("background");
    view = render(reason === "removed" ? [] : [current[0], { ...current[1], id: "photo-" + reason }]);
    assert.ok(!view || typeof media(view).type !== "function", reason);
    released = true;
    video.dispose();
    released = false;
    assert.equal(listeners.size, 0, reason);
    if (reason === "search") {
      focused = true;
      view = render(current);
      assert.ok(typeof media(view).type !== "function", "returns to the retired video's poster");
    }
    if (reason === "background") foreground("active");
    render([]);
    // Return selection to a fresh id when the next independent test starts.
  }
  banner.dispose();
  console.log("PASS actual banner render: fixed frame, one rotation timer, swipe, pause, focus, reduced motion, poster, silent inline video and link");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
