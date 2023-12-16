//
//  ManagementWindow.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/1/23.
//

import FeudKit
import SwiftUI

struct ManagementWindow: View {
    @StateObject private var matchmanager = MatchManager.shared
    @StateObject private var viewstateservice = ViewStateService.shared
    @StateObject private var windowcontroller = ManagementWindowController.shared
    
    var body: some View {
        NavigationStack {
            Grid(horizontalSpacing: 30, verticalSpacing: 30) {
                GridRow {
                    WindowControlPanel()
                    
                    AddFamilyPanel(matchmanager: self.matchmanager, viewstateservice: self.viewstateservice, windowcontroller: self.windowcontroller)
                        .disabled(!self.viewstateservice.addFamilyPanelEnabled)
                    
                    LoadQuestionsPanel(matchmanager: self.matchmanager, viewstateservice: self.viewstateservice, windowcontroller: self.windowcontroller)
                        .disabled(!self.viewstateservice.loadQuestionsPanelEnabled)
                    
                    PlayControlPanel(matchmanager: self.matchmanager, viewstateservice: self.viewstateservice, windowcontroller: self.windowcontroller)
                        .disabled(!self.viewstateservice.playControlPanelEnabled)
                }
                
                GridRow {
                    StateControlPanel(matchmanager: self.matchmanager, viewstateservice: self.viewstateservice, windowcontroller: self.windowcontroller)
                    
                    FamiliesPanel(matchmanager: self.matchmanager, viewstateservice: self.viewstateservice, windowcontroller: self.windowcontroller)
                        .disabled(!self.viewstateservice.familiesPanelEnabled)
                    
                    QuestionSelectorPanel(matchmanager: self.matchmanager, viewstateservice: self.viewstateservice, windowcontroller: self.windowcontroller)
                        .disabled(!self.viewstateservice.questionSelectorPanelEnabled)
                    
                    QuestionControlPanel(matchmanager: self.matchmanager, viewstateservice: self.viewstateservice, windowcontroller: self.windowcontroller)
                        .disabled(!self.viewstateservice.questionControlPanelEnabled)
                }
            }
        }
        .padding()
        .onAppear {
            self.matchmanager.authenticateUser()
        }
    }
}

#Preview {
    ManagementWindow()
}
