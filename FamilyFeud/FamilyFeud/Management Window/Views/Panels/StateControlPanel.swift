//
//  StateControlPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/1/23.
//

import FeudKit
import SwiftUI

struct StateControlPanel: View {
    @ObservedObject private var viewmodel: StateControlViewModel
    
    var body: some View {
        PanelView("State Control") {
            VStack(spacing: 18) {
                Button("New Game") { self.viewmodel.startGame() }
                    .disabled(!self.viewmodel.viewstateservice.newGameEnabled)
                
                Button("Manage Families") { self.viewmodel.manageFamilies() }
                    .disabled(!self.viewmodel.viewstateservice.manageFamiliesEnabled)
                
                Button("Load Question Set") { self.viewmodel.loadQuestions() }
                    .disabled(!self.viewmodel.viewstateservice.loadQuestionEnabled)
                
                Button("Initialize Game") { self.viewmodel.initializeGame() }
                    .disabled(!self.viewmodel.viewstateservice.initializeGameEnabled)
                
                Button("Play Game") { self.viewmodel.playGame() }
                    .disabled(!self.viewmodel.viewstateservice.playGameEnabled)
                
                Button("End Game") { self.viewmodel.endGame() }
                    .disabled(!self.viewmodel.viewstateservice.endGameEnabled)
                
                Button("Fast Money") { self.viewmodel.startFastMoney() }
                    .disabled(!self.viewmodel.viewstateservice.fastMoneyEnabled)
            }
        }
        .frame(width: 200, height: 400, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
        .onAppear {
            self.viewmodel.viewstateservice.newGameEnabled = true
        }
    }
    
    init(matchmanager: MatchManager, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.viewmodel = StateControlViewModel(matchmanager: matchmanager, windowcontroller: windowcontroller, viewstateservice: viewstateservice)
    }
}

#Preview {
    StateControlPanel(matchmanager: MatchManager(), viewstateservice: ViewStateService(), windowcontroller: ManagementWindowController())
}
