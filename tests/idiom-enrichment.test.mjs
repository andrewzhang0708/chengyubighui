import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dictionaryRecord, moeRecord, parseCSV, selectEntry } from '../scripts/idiom-enrichment.mjs';

const readJSON = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const original = readJSON('../data/idioms.json');
const enriched = readJSON('../data/idioms copy.json');
const sources = readJSON('../data/idiom-sources.json');
const entries = Object.values(enriched).flat();

test('enrichment preserves every word, ordering and difficulty', () => {
  for (const level of Object.keys(original)) assert.deepEqual(enriched[level].map(entry => entry.word), original[level]);
  assert.equal(new Set(entries.map(entry => entry.word)).size, entries.length);
});

test('all annotations have explanations and traceable source status; generated entries cannot invent origins', () => {
  for (const entry of entries) {
    assert.ok(entry.explanation.trim(), entry.word);
    if (entry.status === 'generated') {
      assert.equal(entry.explanationSource, 'llm');
      assert.deepEqual(entry.origins, []);
    } else {
      assert.equal(entry.status, 'dictionary');
      assert.ok(sources[entry.explanationSource], entry.word);
    }
    for (const origin of entry.origins) {
      assert.ok(origin.text.trim(), entry.word);
      assert.ok(sources[origin.sourceId], entry.word);
      assert.ok(origin.sourceWord, entry.word);
      assert.ok(!/^(无|暂无|不详)$/.test(origin.text), entry.word);
    }
  }
});

test('the original text may omit the four-character idiom and multiple origins stay separate', () => {
  const walking = entries.find(entry => entry.word === '走马观花');
  assert.equal(walking.origins.length, 2);
  assert.equal(walking.origins[0].kind, 'paraphrase');
  assert.match(walking.origins[0].text, /孟郊/);
  assert.match(walking.origins[1].text, /圍爐詩話/);
  assert.match(entries.find(entry => entry.word === '萍水相逢').origins[0].text, /王勃/);
});

test('dictionary fragments are explicitly linked to the full saying', () => {
  const entry = entries.find(entry => entry.word === '己所不欲');
  assert.equal(entry.relatedWord, '己所不欲，勿施于人');
  assert.equal(entry.origins[0].referenceWord, entry.relatedWord);
});

test('a source with no origin cannot substitute its example; missing placeholders stay empty', () => {
  const first = dictionaryRecord('测试成语', '测试释义', '无', 'a');
  const second = dictionaryRecord('测试成语', '', '《原书》：原文', 'b');
  const result = selectEntry('测试成语', [first, second]);
  assert.equal(result.explanationSource, 'a');
  assert.equal(result.origins[0].sourceId, 'b');
  assert.deepEqual(dictionaryRecord('测试成语', '释义', '暂无', 'a').origins, []);
  for (const placeholder of ['?', '？', '〖出处〗', '元・陆文圭《']) assert.deepEqual(dictionaryRecord('测试成语', '释义', placeholder, 'a').origins, []);
});

test('CSV importer handles commas, escaped quotations, CRLF, empty fields and multiline values', () => {
  assert.deepEqual(parseCSV('1,"成语","含,逗号","引号""内容\n下一行",\r\n'), [['1', '成语', '含,逗号', '引号"内容\n下一行', '']]);
});

test('MOE origins are separated without turning later quotations into origins', () => {
  const entry = moeRecord({ 成語: '测试', 編號: 1, 釋義: ['义一', '义二'], 典源文獻名稱: ['书一', '书二'], 典源文獻內容: ['文一', '＋', '文二'], 書證: ['后世用例'] });
  assert.equal(entry.origins.length, 2);
  assert.equal(entry.origins[1].text, '书二\n文二');
  assert.equal(JSON.stringify(entry).includes('后世用例'), false);
});
