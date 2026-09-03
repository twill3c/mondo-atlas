/** ビルドの刻印(HC-141 / HC-148)。実体は build_stamp.mjs にある。 */

export type StampedFile = {
  /** リポジトリ相対のパス */
  path: string;
  bytes: number;
  /** そのファイル単体の sha256 先頭 12 桁 */
  sha: string;
};

export type BuildStamp = {
  /** 全ファイルを連ねた sha256 の先頭 16 桁 */
  stamp: string;
  files: StampedFile[];
};

/** 刻印の対象。**画面がビルド時に読むデータだけ**を入れる。 */
export declare const STAMPED: readonly string[];

/** 木の内容から刻印を計算する。手元と Vercel で同じ値になること。 */
export declare function computeStamp(root?: string): BuildStamp;
