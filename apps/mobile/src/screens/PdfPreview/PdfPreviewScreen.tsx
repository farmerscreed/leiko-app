// PdfPreview — show the generated doctor report IN the app (founder
// direction, 2026-06-05): after generation the document itself opens,
// with Share handing the actual FILE (not an expiring link) to the OS
// sheet. Renders any local PDF via react-native-pdf.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Pdf from 'react-native-pdf';
import { savePdfToDownloads, sharePdfFile } from '../../services/doctorPdfFile';
import { useTheme } from '../../theme';

export interface PdfPreviewParams {
  /** Local file:// URI of the PDF to display. */
  fileUri: string;
  /** Header title, e.g. "Doctor report · Past 90 days". */
  title: string;
}

// Structural nav typing (Settings/VitalHistory precedent) — the screen is
// registered on both stacks.
type Props = {
  navigation: { goBack: () => void };
  route: { params: PdfPreviewParams };
};

export function PdfPreviewScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { fileUri, title } = route.params;
  const [pageInfo, setPageInfo] = useState<{ page: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Download-to-phone state (founder direction 2026-06-05). 'saving'
  // debounces double-taps; 'ok'/'error' drive the confirmation caption.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');

  const onDownload = async () => {
    if (saveState === 'saving') return;
    setSaveState('saving');
    const filename = fileUri.split('/').pop() ?? 'leiko_report.pdf';
    const res = await savePdfToDownloads(fileUri, filename);
    setSaveState(res.status === 'ok' ? 'ok' : 'error');
  };

  const bodyStyle = theme.type('bodyM');
  const captionStyle = theme.type('caption');

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID="pdf-preview"
    >
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.m,
            borderBottomColor: theme.colors.border.subtle,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={theme.spacing.m}
          testID="pdf-preview-back"
        >
          <Text
            style={{
              color: theme.colors.brand.primary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              fontWeight: '500',
            }}
          >
            Back
          </Text>
        </Pressable>
        <Text
          numberOfLines={1}
          style={[
            styles.headerTitle,
            {
              color: theme.colors.text.primary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              fontWeight: '600',
            },
          ]}
        >
          {title}
        </Text>
        <Pressable
          onPress={() => void sharePdfFile(fileUri)}
          accessibilityRole="button"
          accessibilityLabel="Share the report"
          hitSlop={theme.spacing.m}
          testID="pdf-preview-share"
        >
          <Text
            style={{
              color: theme.colors.brand.primary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              fontWeight: '500',
            }}
          >
            Share
          </Text>
        </Pressable>
      </View>

      {loadError ? (
        <View
          style={{ padding: theme.spacing.xl }}
          testID="pdf-preview-error"
        >
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyStyle.size,
              lineHeight: bodyStyle.lineHeight,
              fontFamily: bodyStyle.family,
            }}
          >
            This report couldn't be opened. Go back and generate it again —
            your readings are safe.
          </Text>
        </View>
      ) : (
        <Pdf
          source={{ uri: fileUri }}
          style={styles.pdf}
          onLoadComplete={(numberOfPages) =>
            setPageInfo({ page: 1, total: numberOfPages })
          }
          onPageChanged={(page, numberOfPages) =>
            setPageInfo({ page, total: numberOfPages })
          }
          onError={() => setLoadError(true)}
        />
      )}

      {!loadError ? (
        <View style={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.s }}>
          <Pressable
            onPress={() => void onDownload()}
            accessibilityRole="button"
            accessibilityLabel="Download the report to your phone"
            disabled={saveState === 'saving'}
            testID="pdf-preview-download"
            style={{
              alignItems: 'center',
              paddingVertical: theme.spacing.m,
              borderRadius: theme.radii.m,
              borderWidth: 1,
              borderColor: theme.colors.brand.primary,
              opacity: saveState === 'saving' ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                color: theme.colors.brand.primary,
                fontSize: bodyStyle.size,
                fontFamily: bodyStyle.family,
                fontWeight: '500',
              }}
            >
              {saveState === 'saving' ? 'Saving…' : 'Download to phone'}
            </Text>
          </Pressable>
          {saveState === 'ok' ? (
            <Text
              style={{
                textAlign: 'center',
                paddingTop: theme.spacing.s,
                color: theme.colors.text.secondary,
                fontSize: captionStyle.size,
                fontFamily: captionStyle.family,
              }}
              testID="pdf-preview-saved"
            >
              Saved to your phone's Downloads folder.
            </Text>
          ) : null}
          {saveState === 'error' ? (
            <Text
              style={{
                textAlign: 'center',
                paddingTop: theme.spacing.s,
                color: theme.colors.text.secondary,
                fontSize: captionStyle.size,
                fontFamily: captionStyle.family,
              }}
              testID="pdf-preview-save-error"
            >
              Couldn't save just now — Share works as a backup.
            </Text>
          ) : null}
        </View>
      ) : null}

      {pageInfo && !loadError ? (
        <Text
          style={{
            textAlign: 'center',
            paddingVertical: theme.spacing.s,
            color: theme.colors.text.tertiary,
            fontSize: captionStyle.size,
            fontFamily: captionStyle.family,
          }}
          testID="pdf-preview-pages"
        >
          Page {pageInfo.page} of {pageInfo.total}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, textAlign: 'center', paddingHorizontal: 8 },
  pdf: { flex: 1, backgroundColor: 'transparent' },
});
