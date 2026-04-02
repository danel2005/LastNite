import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@/lib/design'

// Home screen — event list
// Full implementation in step/14-mobile-event-screens
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Events list — step/14</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, fontSize: 16 },
})
