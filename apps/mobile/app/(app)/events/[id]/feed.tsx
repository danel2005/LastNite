import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@/lib/design'

// Event feed — step/17
export default function EventFeedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Event Feed — step/17</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, fontSize: 16 },
})
