import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@/lib/design'

// Create event flow — step/14
export default function CreateEventScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Create Event — step/14</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, fontSize: 16 },
})
