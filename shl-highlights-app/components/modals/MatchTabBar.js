import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { TabButton } from '../TabButton';

export const MatchTabBar = ({ tabs = [], activeTab, onTabChange, compact = false }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);

    const visibleTabs = tabs.filter((tab) => tab && tab.visible !== false);

    return (
        <View style={themedStyles.tabBar}>
            {visibleTabs.map((tab) => (
                <TabButton
                    key={tab.key}
                    title={tab.title}
                    compactTitle={tab.compactTitle}
                    icon={tab.icon}
                    compact={compact}
                    isActive={activeTab === tab.key}
                    onPress={() => onTabChange(tab.key)}
                />
            ))}
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBorder
    }
});
