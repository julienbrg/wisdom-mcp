import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transcribe, transcribeOriginals } from '../dist/corpus/transcription/index.js';
import { toPinyin } from '../dist/corpus/transcription/pinyin.js';

test('Greek keeps accents and breathings, and writes the iota subscript', () => {
  assert.equal(
    transcribe('grc', 'ΜΑΚΑΡΙΟΙ οἱ πτωχοὶ τῷ πνεύματι, ὅτι αὐτῶν ἐστὶν ἡ βασιλεία τῶν οὐρανῶν.'),
    'MAKARIOI hoi ptōchoì tôi pneúmati, hóti autôn estìn hē basileía tôn ouranôn.',
  );
  assert.equal(transcribe('grc', 'ἐφʼ ἡμῖν; Ἁγιασθήτω·'), 'eph’ hēmîn? Hagiasthḗtō;');
  assert.equal(transcribe('grc', 'ῥῆμα ἄγγελος'), 'rhêma ángelos');
});

test('Hebrew is read from the points, without cantillation', () => {
  assert.equal(
    transcribe('hbo', 'דִּבְרֵי֙ קֹהֶ֣לֶת בֶּן־דָּוִ֔ד מֶ֖לֶךְ בִּירוּשָׁלָֽ͏ִם׃'),
    'divre qohelet ben-david melekh birushalaim.',
  );
  assert.equal(
    transcribe('hbo', 'הֲבֵ֤ל הֲבָלִים֙ אָמַ֣ר קֹהֶ֔לֶת הֲבֵ֥ל הֲבָלִ֖ים הַכֹּ֥ל הָֽבֶל׃'),
    'havel havalim amar qohelet havel havalim hakkol havel.',
  );
});

test('Sanskrit is written in IAST', () => {
  assert.equal(
    transcribe(
      'san',
      'धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय।।1.1।।',
    ),
    'dharmakṣetre kurukṣetre samavetā yuyutsavaḥ|\nmāmakāḥ pāṇḍavāścaiva kimakurvata sañjaya||1.1||',
  );
  assert.equal(transcribe('san', 'एवमुक्त्वाऽर्जुनः संख्ये'), 'evamuktvā’rjunaḥ saṃkhye');
});

test('Pali and unknown languages get no transcription', () => {
  assert.equal(transcribe('pli', 'Manopubbaṅgamā dhammā'), null);
});

const ref = (pos: number, char: string, pinyin: string) => ({
  pos,
  char,
  pinyin,
  source: '經典釋文',
  note: '',
});

test('pinyin takes polyphone readings from the readings file', () => {
  assert.deepEqual(toPinyin('學而時習之，不亦說乎？', [ref(8, '說', 'yuè')]), {
    text: 'xué ér shí xí zhī, bù yì yuè hū?',
    missing: [],
  });
  assert.equal(
    toPinyin('子曰：「知者樂水，仁者樂山。」', [
      ref(4, '知', 'zhì'),
      ref(6, '樂', 'yào'),
      ref(11, '樂', 'yào'),
    ]).text,
    'zǐ yuē: “zhì zhě yào shuǐ, rén zhě yào shān.”',
  );
});

test('pinyin lists polyphones that have no reading', () => {
  assert.deepEqual(toPinyin('知者樂水').missing, [
    { pos: 0, char: '知' },
    { pos: 2, char: '樂' },
  ]);
  assert.throws(() => toPinyin('知者樂水', [ref(1, '樂', 'yào')]), /reading at 1 is for 樂/);
});

test('the Analects take their readings from data/pinyin/analects.json', () => {
  const body = '子曰：「學而時習之，不亦說乎？有朋自遠方來，不亦樂乎？人不知而不慍，不亦君子乎？」';
  assert.deepEqual(transcribeOriginals('analects', 'lzh', [{ refUnit: '1.1', body }]), [
    'zǐ yuē: “xué ér shí xí zhī, bù yì yuè hū? yǒu péng zì yuǎn fāng lái, bù yì lè hū? ' +
      'rén bù zhī ér bù yùn, bù yì jūn zǐ hū?”',
  ]);
});

test('the import fails and lists polyphones that have no reviewed reading', () => {
  assert.throws(
    () => transcribeOriginals('analects', 'lzh', [{ refUnit: '0.0', body: '知者樂水' }]),
    /2 polyphones have no reviewed reading[\s\S]*analects 0\.0 @0 知\nanalects 0\.0 @2 樂/,
  );
});
