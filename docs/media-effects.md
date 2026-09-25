# 前景・背景の演出 / Media effects

前景・背景の各カットで、ひとつの手法を選択します。

- **演出無し**：素材を即時表示し、静止した配置で表示します。動画そのものの再生は続きます。
- **自動**：詳細 → 画像・動画で有効にした手法から選びます。
- **手法名**：登場・保持・退場・加工・つなぎをまとめた手法を固定します。

80種類の手法を、シネマ・カメラ、ダイナミックモーション、マスク・出現、色・質感、分割・残像・グリッチ、カット間のつなぎから選べます。詳細タブでは、動きの強さ、加工の強さ、登場・退場の秒数と、自動選定に含める手法を設定できます。前景と背景で共通です。

「画像・動画をシャッフル」は両レイヤーを再抽選します。通常のシャッフルでも自動の素材カットを再抽選します。明示的に選んだ手法・演出無し・ロックしたカットは維持されます。各カットのサイコロは、そのカットを自動へ切り替えて再抽選します。

「ランダム順で表示」は、素材が2つ以上あれば、カット追加・削除やタップ同期の後も使えます。オンの間は素材一覧からランダムな順で割り当て、繰り返し表示します。空カットとロックしたカットは維持します。素材の個別指定はオフにすると再び使え、元の割り当てに戻ります。

旧プロジェクトで個別指定した6項目は「従来の設定」として維持します。別の手法を選ぶと新しい設定が優先されます。配置・サイズは、手動設定がなければ演出に合わせて自動選定され、シャッフルで変化します。縦横比を保ったまま、中央・左右・上下・四隅などの構図とサイズを選びます。背景の自動サイズは「全体を表示」を100％として100〜135％で選定し、拡大した範囲内で位置を変えます。手動配置とロック済みの配置は維持されます。「自動配置に戻す」で再び自動選定できます。詳細の「配置・サイズにも自動で変化を付ける」をオフにすると中央の全体表示に戻ります（手動配置・ロックを除く）。演出無しと従来の設定は従来通りの配置です。動画ループ、クロマキー、開始時刻は手法とは独立しています。つなぎは隣接する素材カットがある場合に適用されます。

## 追加バリエーション（第2弾）

33種類を追加しました。各カットの手法選択はカテゴリ別に表示されます。

| カテゴリ | 追加内容 |
| --- | --- |
| シネマ・モーション（8種類） | アーチ移動、8の字、奥行き軌道、スパイラル着地、スリングショット、ホッピング、ジグザグ、ブーメラン |
| マスク・出現（10種類） | 斜めスリット、扇、クロス、ハニカム、波形、ピクセル散開、同心円、交互シャッター、シェブロン、対角モザイク |
| 分割・残像（10種類） | ウェーブスライス、ズーム残響、4分割ミラー、フィルムストリップ、万華鏡、ミラーデュオ、サテライト、ピクセルモザイク、リボン分解、RGB分離 |
| 色・質感（5種類） | インクシルエット、グラデーション染め、ネオン輪郭、ライトスイープ、ドットプリント |

透過素材・クロマキー処理後の動画にも使用できます。マスクや加工は素材の透明度を使って描画し、元動画のフレーム更新にも追従します。

## English

Choose **No effects**, **Auto**, or a named technique on each foreground/background cut. No effects displays the file instantly without added motion; videos continue playing normally.

**Details → Media** contains 80 techniques, grouped into cinema/camera, dynamic motion, masks/reveals, color/texture, panels/echoes/glitch, and cut transitions. Adjust motion and treatment intensity, entrance/exit duration, and the techniques included in Auto. Settings apply to both media layers.

**Shuffle media** rerolls automatic cuts in both layers. Explicit selections and locked cuts are preserved. A cut's dice button switches it to Auto and rerolls it. Existing projects keep their individual settings as **Legacy settings** until a new technique is selected. With automatic placement enabled, effect cuts without manual placement vary their position and size on shuffle, preserving the source aspect ratio. Automatic background size stays between 100% and 135% of the full-fit size, with position shifts limited to the available crop on enlarged axes. Manual placement and locked cuts stay fixed. Use Reset automatic placement to return a manually placed cut to automatic composition. Disable Vary position and size automatically in Details to keep automatic cuts centered at full fit. No effects and Legacy settings retain their original framing. Video looping, chroma key, and timing remain independent of technique selection. Transitions apply between adjacent media cuts.

The second pack adds 33 techniques: 8 camera/motion variations, 10 masks/reveals, 10 panel/echo effects, and 5 color/texture treatments. Per-cut choices are grouped by category. New effects support transparent assets and live video frames; selection is deterministic for the same seed.

Random order remains available after adding/removing cuts or tap sync when at least two files are uploaded. While enabled, media is assigned in a seeded shuffled cycle; blank and locked cuts are preserved. Turn it off to restore the underlying assignments and select files individually.
