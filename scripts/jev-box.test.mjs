import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boxInput, locatePost } from './jev-box.mjs';

const image = readFileSync(new URL('../fixtures/jev/post-550.jpg', import.meta.url));
const env = { CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_GATEWAY_ID: 'proof', CF_WORKERS_AI_TOKEN: 'fake', CF_AIG_TOKEN: 'fake' };

test('screenshot and profile reach the native gateway request; negative presence is preserved', async () => {
  const input = boxInput(image, 'I make ceramic bowls.');
  assert.equal(input.assets[input.state.screenshot].format, 'jpg');
  assert.deepEqual(Buffer.from(input.assets[input.state.screenshot].data_base64, 'base64'), image);
  const recorded = JSON.parse(readFileSync(new URL('../fixtures/jev/result-550.json', import.meta.url)));
  const result = await locatePost(input, env, async (url, options) => {
    assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts/test/ai/run');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'typesafe/jev-1.14.0');
    assert.equal(body.input.state.viewer_profile, 'I make ceramic bowls.');
    assert.equal(body.input.questions.present.type, 'noul');
    assert.equal(body.input.questions.box.type, 'box');
    assert.equal(options.headers['TypeSafe-Danger-Zone-Images'], 'true');
    return Response.json({ success: true, result: { state: 'Completed', result: recorded.result } });
  });
  assert.equal(result.answers.ceramics_present.noul, 0.01);
  assert.ok(result.answers.ceramics_box.box);
});

test('invalid inputs and failed requests do not produce successful results', async () => {
  assert.throws(() => boxInput(Buffer.from('not an image'), 'AI'), /PNG or JPEG/);
  assert.throws(() => boxInput(image, ' '), /profile/);
  const input = boxInput(image, 'AI');
  await assert.rejects(locatePost(input, {}), /Missing CLOUDFLARE_ACCOUNT_ID/);
  await assert.rejects(locatePost(input, env, async () => new Response('', { status: 429 })), /429/);
  await assert.rejects(locatePost(input, env, async () => Response.json({ success: false })), /no answers/);
});
