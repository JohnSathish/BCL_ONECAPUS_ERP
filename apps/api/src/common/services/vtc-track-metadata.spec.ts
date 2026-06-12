import {
  expectedVtcStageForSemester,
  parseVtcTrackMetadata,
  resolveVtcTrackFields,
} from './vtc-track-metadata';

describe('vtc-track-metadata', () => {
  it('parses numeric VTC codes with roman stage', () => {
    expect(parseVtcTrackMetadata('VTC-243.2', 'Desktop Publishing-I')).toEqual({
      vtcTrackGroupCode: '243.2',
      vtcTrackStage: 1,
    });
    expect(parseVtcTrackMetadata('VTC-263.2', 'Desktop Publishing-II')).toEqual(
      {
        vtcTrackGroupCode: '263.2',
        vtcTrackStage: 2,
      },
    );
  });

  it('parses bee keeping track', () => {
    expect(parseVtcTrackMetadata('VTC-240.3', 'Bee Keeping-I')).toEqual({
      vtcTrackGroupCode: '240.3',
      vtcTrackStage: 1,
    });
  });

  it('prefers explicit fields over parsed', () => {
    expect(
      resolveVtcTrackFields({
        code: 'VTC-243.2',
        title: 'Desktop Publishing-I',
        vtcTrackGroupCode: 'DESKTOP_PUBLISHING',
        vtcTrackStage: 2,
      }),
    ).toEqual({
      vtcTrackGroupCode: 'DESKTOP_PUBLISHING',
      vtcTrackStage: 2,
    });
  });

  it('maps semester to expected VTC stage', () => {
    expect(expectedVtcStageForSemester(3)).toBe(1);
    expect(expectedVtcStageForSemester(4)).toBe(2);
    expect(expectedVtcStageForSemester(6)).toBe(3);
    expect(expectedVtcStageForSemester(1)).toBeNull();
  });
});
