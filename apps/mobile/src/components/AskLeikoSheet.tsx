// AskLeikoSheet — Sprint 12 follow-up.
//
// Bottom-sheet wrapper around <AskLeikoBody/> for the home-screen
// floating "Ask Leiko" button. Same input + response surface as the
// AskLeikoScreen route, just hosted in a dismissable sheet.
//
// Tapping a Learn card link inside the sheet dismisses the sheet
// FIRST, then navigates — so the user lands on the article cleanly
// instead of seeing it slide up behind a still-open sheet.

import { ScrollView, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { AskLeikoBody } from './AskLeikoBody';
import { useTheme } from '../theme';

export interface AskLeikoSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Navigate to an article. The sheet auto-dismisses before calling. */
  onArticleOpen: (articleId: string) => void;
  testID?: string;
}

export function AskLeikoSheet({
  visible,
  onDismiss,
  onArticleOpen,
  testID,
}: AskLeikoSheetProps) {
  const theme = useTheme();
  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      size="tall"
      title="Ask Leiko"
      testID={testID ?? 'ask-leiko-sheet'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.spacing.l, paddingBottom: theme.spacing.xxxl }}
      >
        <View>
          <AskLeikoBody
            onArticleOpen={(id) => {
              onDismiss();
              onArticleOpen(id);
            }}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
