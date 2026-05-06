import { LayoutAnimation, Platform, UIManager } from 'react-native';

let enabledAndroid = false;

export function runLayoutAnimation() {
  if (Platform.OS === 'android' && !enabledAndroid) {
    // Safe no-op on old Androids / unsupported environments.
    try {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
      enabledAndroid = true;
    } catch {
      enabledAndroid = true;
    }
  }

  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

