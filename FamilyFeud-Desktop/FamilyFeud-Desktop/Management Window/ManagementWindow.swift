//
//  ManagementWindow.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/1/23.
//

import FeudKit
import SwiftUI

struct ManagementWindow: View {
    @Environment(FamilyFeudGame.self) private var game
    @Environment(\.openWindow) private var openWindow
    var body: some View {
        NavigationStack {
            Grid(horizontalSpacing: 30, verticalSpacing: 30) {
                GridRow {
                    WindowControlPanel()
                    
                    AddFamilyPanel()
                    
                    LoadQuestionsPanel(game: self.game)
                    
                    PlayControlPanel()
                }
                
                GridRow {
                    StateControlPanel(game: self.game)
                    
                    FamiliesPanel(families: [])
                    
                    QuestionSelectorPanel(game: self.game)
                    
                    QuestionControlPanel(answers: [])
                }
            }
        }
        .padding()
    }
}

#Preview {
    ManagementWindow()
        .environment(FamilyFeudGame())
}
