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
    @Environment(ViewStateService.self) private var viewstateservice
    @Environment(MultiplayerService.self) private var multiplayerservice
    
    @State var controller: ManagementWindowController = .init()
    var body: some View {
        NavigationStack {
            Grid(horizontalSpacing: 30, verticalSpacing: 30) {
                GridRow {
                    WindowControlPanel()
                    
                    AddFamilyPanel(game: self.game, viewstateservice: self.viewstateservice, windowcontroller: self.controller)
                        .disabled(!self.viewstateservice.addFamilyPanelEnabled)
                    
                    LoadQuestionsPanel(game: self.game, viewstateservice: self.viewstateservice, windowcontroller: self.controller)
                        .disabled(!self.viewstateservice.loadQuestionsPanelEnabled)
                    
                    PlayControlPanel(game: self.game, viewstateservice: self.viewstateservice, windowcontroller: self.controller)
                        .disabled(!self.viewstateservice.playControlPanelEnabled)
                }
                
                GridRow {
                    StateControlPanel(game: self.game, viewstateservice: self.viewstateservice, windowcontroller: self.controller, multiplayerservice: self.multiplayerservice)
                    
                    FamiliesPanel(game: self.game, viewstateservice: self.viewstateservice, windowcontroller: self.controller)
                        .disabled(!self.viewstateservice.familiesPanelEnabled)
                    
                    QuestionSelectorPanel(game: self.game, viewstateservice: self.viewstateservice, windowcontroller: self.controller)
                        .disabled(!self.viewstateservice.questionSelectorPanelEnabled)
                    
                    QuestionControlPanel(game: self.game, viewstateservice: self.viewstateservice, windowcontroller: self.controller)
                        .disabled(!self.viewstateservice.questionControlPanelEnabled)
                }
            }
        }
        .padding()
        .onAppear {
            if !self.multiplayerservice.playingGame {
                self.multiplayerservice.authenticatePlayer()
            }
        }
    }
}

#Preview {
    ManagementWindow()
        .environment(FamilyFeudGame())
        .environment(ViewStateService())
}
