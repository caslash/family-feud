//
//  FamiliesPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/2/23.
//

import FeudKit
import SwiftUI

struct FamiliesPanel: View {
    @ObservedObject private var viewmodel: FamiliesViewModel
    
    var body: some View {
        PanelView("Families") {
            VStack(spacing: 18) {
                Table(self.viewmodel.families, selection: self.$viewmodel.selectedFamilyId) {
                    TableColumn("Family", value: \.familyName)
                    TableColumn("Points", value: \.points.description)
                }
                
                    Button("Select") { self.viewmodel.select() }
            }
        }
        .padding()
        .frame(width: 400, height: 400, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
    }
    
    init(matchmanager: MatchManager, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.viewmodel = FamiliesViewModel(matchmanager: matchmanager, windowcontroller: windowcontroller, viewstateservice: viewstateservice)
    }
}

#Preview {
    FamiliesPanel(matchmanager: MatchManager(), viewstateservice: ViewStateService(), windowcontroller: ManagementWindowController())
}
