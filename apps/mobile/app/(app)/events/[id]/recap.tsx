import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@/lib/design'

// Recap — step/18
export default function RecapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Recap — step/18</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, fontSize: 16 },
})
