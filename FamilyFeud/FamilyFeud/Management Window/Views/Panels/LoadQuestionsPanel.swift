//
//  LoadQuestionsPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/1/23.
//

import FeudKit
import SwiftUI

struct LoadQuestionsPanel: View {
    @ObservedObject private var viewmodel: LoadQuestionsViewModel
    
    var body: some View {
        PanelView("Load Question") {
            Button("Load File") { self.viewmodel.getQuestions() }
        }
        .frame(width: 400, height: 200, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
    }
    
    init(matchmanager: MatchManager, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.viewmodel = LoadQuestionsViewModel(matchmanager: matchmanager, windowcontroller: windowcontroller, viewstateservice: viewstateservice)
    }
}

#Preview {
    LoadQuestionsPanel(matchmanager: MatchManager(), viewstateservice: ViewStateService(), windowcontroller: ManagementWindowController())
}
